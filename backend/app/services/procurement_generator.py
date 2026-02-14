"""采购计划生成服务。

基于品类规则、产品配置与预算区间生成每日采购明细，并支持定期采购插入。
"""
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from decimal import Decimal
import random

from fastapi import HTTPException

from app.services.number_utils import random_decimal, round_decimal
from app.services.unit_rules import quantity_precision_for_unit, quantity_step_for_unit
from app.services.workdays import get_workdays, shift_to_next_workday
from app.services.rule_validation import collect_rule_gaps


@dataclass
class BudgetRange:
    min: Decimal
    max: Decimal


# 业务侧统一使用 2 位金额精度，不再受系统设置影响
DEFAULT_MONEY_PRECISION = 2
MAX_MIN_COST_SWAP_TRIES = 5
MAX_DAILY_BUDGET_RETRY = 5
MAX_DAILY_MIN_ADD_TRIES = 5


def _parse_budget_range(payload: dict | None) -> BudgetRange | None:
    """将配置中的预算区间解析为 Decimal 结构。"""
    if not payload:
        return None
    return BudgetRange(min=Decimal(str(payload["min"])), max=Decimal(str(payload["max"])))


def _decimal(value: Decimal | float | int) -> Decimal:
    """统一数值到 Decimal，避免浮点误差。"""
    return Decimal(str(value))


def _normalize_base_price(value: Decimal) -> Decimal:
    """基础单价统一按两位小数，最小值 0.01。"""
    rounded = value.quantize(Decimal("0.01"))
    return Decimal("0.01") if rounded < Decimal("0.01") else rounded


def _normalize_volatility_price(value: Decimal) -> Decimal:
    """波动后单价统一按两位小数做 banker's rounding，最小值 0.01。"""
    rounded = value.quantize(Decimal("0.01"))
    return Decimal("0.01") if rounded < Decimal("0.01") else rounded


def _step_quantize(value: Decimal, step: Decimal) -> Decimal:
    """按步进对数量进行量化，保持与采购数量步进一致。"""
    if step <= 0:
        return value
    steps = (value / step).to_integral_value(rounding="ROUND_HALF_UP")
    return steps * step


def _random_quantity(min_value: Decimal, max_value: Decimal, step: Decimal, fallback_precision: int) -> Decimal:
    """在区间内按步进生成随机数量，步进无效时按精度随机。"""
    if step <= 0:
        return random_decimal(min_value, max_value, fallback_precision)
    min_steps = int((min_value / step).to_integral_value(rounding="ROUND_CEILING"))
    max_steps = int((max_value / step).to_integral_value(rounding="ROUND_FLOOR"))
    if max_steps < min_steps:
        return random_decimal(min_value, max_value, fallback_precision)
    return step * Decimal(random.randint(min_steps, max_steps))


def _min_quantity_for_product(item_quantity_range: dict, step: Decimal) -> Decimal:
    """根据采购数量范围与步进，推算可行的最小采购数量。"""
    min_value = _decimal(item_quantity_range["min"])
    if step <= 0:
        return min_value
    min_steps = (min_value / step).to_integral_value(rounding="ROUND_CEILING")
    return step * min_steps


def _max_price_for_product(product: dict) -> Decimal:
    """计算考虑波动后的最高单价，用于预算估算。"""
    base_price = _normalize_base_price(_decimal(product["base_price"]))
    volatility = _decimal(product.get("volatility", 0))
    price = base_price * (_decimal(1) + volatility)
    return _normalize_volatility_price(price)


def _estimate_min_cost(product: dict, precision: int) -> Decimal:
    """估算单品的最小成本，供预算内选品筛选使用。"""
    item_quantity_range = product.get("item_quantity_range")
    if not item_quantity_range:
        return Decimal("0")
    step = quantity_step_for_unit(product.get("unit", ""))
    min_qty = _min_quantity_for_product(item_quantity_range, step)
    max_price = _max_price_for_product(product)
    return round_decimal(min_qty * max_price, precision)


def _load_settings(doc: dict | None) -> dict:
    """从设置文档读取配置，提供默认值兜底。"""
    if not doc:
        return {
            "daily_budget_range": None,
        }
    return {
        "daily_budget_range": doc.get("daily_budget_range"),
    }


def _allocate_daily_budgets(
    days: int,
    daily_range: BudgetRange,
    precision: int,
) -> list[Decimal]:
    """为每个工作日生成目标预算金额。"""
    if days <= 0:
        return []

    return [
        random_decimal(daily_range.min, daily_range.max, precision)
        for _ in range(days)
    ]


def _pick_items_count(count_range: dict | None, default_count: int) -> int:
    """按选品数量范围随机抽取数量，失败时返回默认值。"""
    if not count_range:
        return default_count
    try:
        min_value = int(count_range["min"])
        max_value = int(count_range["max"])
    except (TypeError, ValueError, KeyError):
        return default_count
    if min_value > max_value:
        return default_count
    if max_value < 1:
        return default_count
    min_value = max(1, min_value)
    return random.randint(min_value, max_value)


async def _build_periodic_schedule(
    db,
    products_by_category: dict[str, list[dict]],
    categories_by_id: dict[str, dict],
    workdays: list[date],
    year: int,
    month: int,
) -> dict[date, list[dict]]:
    """生成定期采购的投放计划，按周期与浮动天数选定日期。"""
    schedule: dict[date, list[dict]] = defaultdict(list)
    if not workdays:
        return schedule

    for category_id, category in categories_by_id.items():
        if category.get("purchase_mode") != "periodic":
            continue
        if category.get("cycle_days") is None or category.get("float_days") is None:
            continue
        products = products_by_category.get(category_id, [])
        for product in products:
            product_id = str(product.get("_id"))
            last = await (
                db["procurement_plans"]
                .find({"items.product_id": product_id})
                .sort("date", -1)
                .limit(1)
                .to_list(1)
            )
            if last:
                # 有历史采购记录时按周期顺延
                last_date = date.fromisoformat(last[0]["date"])
                jitter = random.randint(-int(category["float_days"]), int(category["float_days"]))
                target = last_date + timedelta(days=int(category["cycle_days"]) + jitter)
            else:
                # 无历史记录时随机落到当月工作日
                target = random.choice(workdays)

            if target.year != year or target.month != month:
                continue

            # 确保落在工作日
            target = shift_to_next_workday(target, workdays)
            if target is None:
                continue
            schedule[target].append(product)

    return schedule


def _build_item(
    product: dict,
    category: dict,
    precision: int,
    quantity_override: Decimal | None = None,
    rng: random.Random | None = None,
) -> dict:
    """构建单个采购明细，包含价格、数量与金额。"""
    base_price = _normalize_base_price(_decimal(product["base_price"]))
    raw_volatility = product.get("volatility")
    if raw_volatility is None:
        raise HTTPException(status_code=409, detail="产品缺少单价波动配置")
    volatility = _decimal(raw_volatility)
    # 在波动范围内随机生成单价
    chooser = rng if rng is not None else random
    price_factor = _decimal(1) + _decimal(chooser.uniform(float(-volatility), float(volatility)))
    price = _normalize_volatility_price(base_price * price_factor)

    item_quantity_range = product.get("item_quantity_range")
    if not item_quantity_range:
        raise HTTPException(status_code=409, detail="产品缺少采购数量范围配置")
    quantity_step = quantity_step_for_unit(product.get("unit", ""))
    quantity_precision = quantity_precision_for_unit(product.get("unit", ""))
    # 按步进生成采购数量
    if quantity_override is not None:
        quantity = quantity_override
    else:
        quantity = _random_quantity(
            _decimal(item_quantity_range["min"]),
            _decimal(item_quantity_range["max"]),
            quantity_step,
            quantity_precision,
        )
    quantity = round_decimal(quantity, quantity_precision)
    amount = round_decimal(price * quantity, precision)

    # 若金额精度为 0，保证单品金额至少为 1 元，尽量在范围内提升数量
    if precision == 0 and amount < 1 and price > 0:
        needed_qty = _decimal(1) / price
        if quantity_step > 0:
            steps_needed = (needed_qty / quantity_step).to_integral_value(rounding="ROUND_CEILING")
            needed_qty = steps_needed * quantity_step
        else:
            needed_qty = needed_qty.to_integral_value(rounding="ROUND_CEILING")
        qty_max = _decimal(item_quantity_range.get("max", needed_qty))
        if needed_qty > qty_max:
            needed_qty = qty_max
        quantity = round_decimal(needed_qty, quantity_precision)
        amount = round_decimal(price * quantity, precision)

    return {
        "product_id": str(product["_id"]),
        "category_id": product.get("category_id"),
        "category_name": product.get("category_name"),
        "name": product["name"],
        "unit": product.get("unit", ""),
        "price": price,
        "quantity": quantity,
        "amount": amount,
        "_qty_min": _decimal(item_quantity_range["min"]),
        "_qty_max": _decimal(item_quantity_range["max"]),
        "_qty_step": quantity_step,
    }


def _adjust_to_budget(items: list[dict], target: Decimal, precision: int) -> None:
    """在不突破单品范围的前提下，尽量贴合目标预算。"""
    if not items:
        return

    adjustables = [item for item in items if "_qty_min" in item]
    if not adjustables:
        return

    # 多轮贪心调整，直到无法再靠近目标
    for _ in range(5):
        current_total = sum(item["amount"] for item in items)
        delta = target - current_total
        if abs(delta) < 0.01:
            return
        # 增加预算时优先低价商品，减少预算时优先高价商品
        adjustables.sort(key=lambda x: x["price"] if delta > 0 else -x["price"])
        for item in adjustables:
            if abs(delta) < 0.01:
                break
            price = item["price"]
            step = item.get("_qty_step") or Decimal("0")
            quantity_precision = _step_precision(step)
            max_add = item["_qty_max"] - item["quantity"]
            max_sub = item["quantity"] - item["_qty_min"]
            if delta > 0:
                add_qty = min(delta / price, max_add)
                if add_qty > 0:
                    new_qty = item["quantity"] + add_qty
                    if step > 0:
                        new_qty = _step_quantize(new_qty, step)
                    item["quantity"] = round_decimal(new_qty, quantity_precision)
                    item["amount"] = round_decimal(item["quantity"] * price, precision)
                    delta -= add_qty * price
            else:
                sub_qty = min(-delta / price, max_sub)
                if sub_qty > 0:
                    new_qty = item["quantity"] - sub_qty
                    if step > 0:
                        new_qty = _step_quantize(new_qty, step)
                    item["quantity"] = round_decimal(new_qty, quantity_precision)
                    item["amount"] = round_decimal(item["quantity"] * price, precision)
                    delta += sub_qty * price

    # 最后再微调一个商品，尽量贴合 target
    current_total = sum(item["amount"] for item in items)
    delta = target - current_total
    if abs(delta) >= 0.01:
        for item in adjustables:
            price = item["price"]
            new_quantity = item["quantity"] + (delta / price)
            step = item.get("_qty_step") or Decimal("0")
            if step > 0:
                new_quantity = _step_quantize(new_quantity, step)
            new_quantity = round_decimal(new_quantity, _step_precision(step))
            if item["_qty_min"] <= new_quantity <= item["_qty_max"]:
                item["quantity"] = new_quantity
                item["amount"] = round_decimal(new_quantity * price, precision)
                break


def _step_precision(step: Decimal) -> int:
    """根据步进值计算数量保留小数位数。"""
    text = format(step, "f")
    if "." not in text:
        return 0
    return len(text.rstrip("0").split(".")[1])


def _cleanup_items(items: list[dict]) -> list[dict]:
    """移除内部计算字段，输出对外可用的明细结构。"""
    cleaned = []
    for item in items:
        item.pop("_qty_min", None)
        item.pop("_qty_max", None)
        item.pop("_qty_step", None)
        cleaned.append(item)
    return cleaned


def _month_range(start_year: int, start_month: int, end_year: int, end_month: int) -> list[tuple[int, int]]:
    """生成起止年月范围内的所有年月列表。"""
    months: list[tuple[int, int]] = []
    current = date(start_year, start_month, 1)
    end = date(end_year, end_month, 1)
    while current <= end:
        months.append((current.year, current.month))
        if current.month == 12:
            current = date(current.year + 1, 1, 1)
        else:
            current = date(current.year, current.month + 1, 1)
    return months


def _rng_for_day(day: date) -> random.Random:
    """基于日期生成稳定随机源。"""
    seed = int(day.strftime("%Y%m%d"))
    return random.Random(seed)


def _product_base_price(product: dict) -> Decimal:
    """获取产品基准单价。"""
    return _decimal(product.get("base_price", 0))


def _select_products(
    candidates: list[dict],
    desired_count: int,
    rng: random.Random,
) -> list[dict]:
    """在候选集中尽量随机选品。"""
    if desired_count <= 0 or not candidates:
        return []
    if len(candidates) <= desired_count:
        return candidates
    return rng.sample(candidates, desired_count)


def _min_cost_total(products: list[dict], precision: int) -> Decimal:
    """计算一组产品的最低成本合计。"""
    total = Decimal("0")
    for product in products:
        total += _estimate_min_cost(product, precision)
    return total


def _try_lower_cost_swap(
    chosen: list[dict],
    candidates: list[dict],
    rng: random.Random,
    precision: int,
    budget_max: Decimal,
    max_tries: int = MAX_MIN_COST_SWAP_TRIES,
) -> tuple[list[dict], Decimal]:
    """若最低成本超预算，尝试替换高价产品为更低价产品以降低最低成本。"""
    if not chosen or max_tries <= 0:
        return chosen, _min_cost_total(chosen, precision)

    chosen_ids = {str(item.get("_id")) for item in chosen}
    best = chosen
    best_cost = _min_cost_total(chosen, precision)

    for _ in range(max_tries):
        priciest = max(chosen, key=_product_base_price)
        priciest_price = _product_base_price(priciest)
        lower_pool = [
            item
            for item in candidates
            if str(item.get("_id")) not in chosen_ids
            and _product_base_price(item) < priciest_price
        ]
        if not lower_pool:
            break
        replacement = rng.choice(lower_pool)
        new_chosen = [item for item in chosen if item is not priciest]
        new_chosen.append(replacement)
        new_cost = _min_cost_total(new_chosen, precision)
        if new_cost < best_cost:
            best = new_chosen
            best_cost = new_cost
        chosen = new_chosen
        chosen_ids = {str(item.get("_id")) for item in chosen}
        if new_cost <= budget_max:
            return chosen, new_cost

    return best, best_cost


def _best_within_budget(
    candidates: list[dict],
    desired_count: int,
    rng: random.Random,
    precision: int,
    budget_max: Decimal,
    max_tries: int = MAX_DAILY_BUDGET_RETRY,
) -> tuple[list[dict], Decimal]:
    """重复随机选品，尽量找到预算内的最低成本组合。"""
    best = []
    best_cost = Decimal("0")
    for idx in range(max_tries):
        chosen = _select_products(candidates, desired_count, rng)
        chosen, min_cost_total = _try_lower_cost_swap(
            chosen,
            candidates,
            rng,
            precision,
            budget_max,
            MAX_MIN_COST_SWAP_TRIES,
        )
        if idx == 0 or min_cost_total < best_cost:
            best = chosen
            best_cost = min_cost_total
        if min_cost_total <= budget_max:
            return chosen, min_cost_total
    return best, best_cost


async def generate_plans(
    db,
    start_year: int,
    start_month: int,
    end_year: int,
    end_month: int,
    creator_id: str | None = None,
) -> tuple[list[dict], list[dict]]:
    """生成指定时间范围内的采购计划列表。"""
    settings_doc = await db["settings"].find_one({"key": "global"})
    settings = _load_settings(settings_doc)

    # 校验是否存在未配置规则的品类
    gap = await collect_rule_gaps(db)
    if gap["categories_without_rules"]:
        raise HTTPException(status_code=409, detail="存在未配置规则的品类")

    categories = await db["categories"].find({"is_active": True}).to_list(1000)
    products = await db["products"].find({"is_deleted": False}).to_list(10000)
    if not products:
        raise HTTPException(status_code=409, detail="产品库为空")

    categories_by_id = {str(doc["_id"]): doc for doc in categories}
    category_name_map = {doc.get("name"): str(doc.get("_id")) for doc in categories if doc.get("name")}
    products_by_category: dict[str, list[dict]] = defaultdict(list)
    for product in products:
        category_id = product.get("category_id")
        if not category_id:
            legacy_name = product.get("category_name") or product.get("category")
            category_id = category_name_map.get(legacy_name)
            if category_id:
                product["category_id"] = category_id
                product["category_name"] = legacy_name
        if category_id:
            products_by_category[category_id].append(product)

    daily_range = _parse_budget_range(settings.get("daily_budget_range"))
    if daily_range is None:
        raise HTTPException(status_code=409, detail="未配置预算区间")
    if daily_range.min > daily_range.max:
        raise HTTPException(status_code=409, detail="预算区间无效")

    precision = DEFAULT_MONEY_PRECISION
    plans: list[dict] = []
    warnings: list[dict] = []

    for year, month in _month_range(start_year, start_month, end_year, end_month):
        workdays = await get_workdays(year, month)
        if not workdays:
            continue

        budgets = _allocate_daily_budgets(len(workdays), daily_range, precision)
        periodic_schedule = await _build_periodic_schedule(
            db,
            products_by_category,
            categories_by_id,
            workdays,
            year,
            month,
        )

        for idx, day in enumerate(workdays):
            items: list[dict] = []
            daily_items: list[dict] = []
            used_products: set[str] = set()
            target_budget = budgets[idx]
            rng = _rng_for_day(day)
            day_warnings: list[dict] = []
            daily_category_limits: dict[str, int] = {}
            daily_category_candidates: dict[str, list[dict]] = {}
            daily_category_selected: dict[str, list[dict]] = defaultdict(list)

            periodic_products = periodic_schedule.get(day, [])
            if periodic_products:
                periodic_by_category: dict[str, list[dict]] = defaultdict(list)
                for product in periodic_products:
                    category_id = product.get("category_id")
                    if not category_id:
                        continue
                    periodic_by_category[category_id].append(product)

                for category_id, products in periodic_by_category.items():
                    category = categories_by_id.get(category_id)
                    if not category:
                        continue
                    count = _pick_items_count(category.get("items_count_range"), len(products))
                    count = min(count, len(products))
                    chosen = products if count >= len(products) else rng.sample(products, count)
                    for product in chosen:
                        item = _build_item(product, category, precision, rng=rng)
                        used_products.add(item["product_id"])
                        items.append(item)

            # 生成每日采购品类的明细
            for category_id, category in categories_by_id.items():
                if category.get("purchase_mode") != "daily":
                    continue
                candidates = [
                    p for p in products_by_category.get(category_id, []) if str(p["_id"]) not in used_products
                ]
                if not candidates:
                    warning = {
                        "date": day.isoformat(),
                        "category_id": category_id,
                        "category_name": category.get("name"),
                        "reason": "品类无可用产品",
                    }
                    warnings.append(warning)
                    day_warnings.append(warning)
                    continue
                count_range = category.get("items_count_range") or {}
                min_count = int(count_range.get("min", 1))
                max_count = int(count_range.get("max", min_count))
                available = len(candidates)
                if available < min_count:
                    warning = {
                        "date": day.isoformat(),
                        "category_id": category_id,
                        "category_name": category.get("name"),
                        "reason": "品类产品数量不足以满足下限",
                        "available": available,
                        "min_required": min_count,
                    }
                    warnings.append(warning)
                    day_warnings.append(warning)
                desired_count = _pick_items_count(category.get("items_count_range"), 1)
                max_count = min(max(max_count, min_count), available)
                desired_count = min(max(min_count, desired_count), max_count)
                chosen, min_cost_total = _best_within_budget(
                    candidates,
                    desired_count,
                    rng,
                    precision,
                    daily_range.max,
                    MAX_DAILY_BUDGET_RETRY,
                )
                daily_category_limits[category_id] = max_count
                daily_category_candidates[category_id] = candidates
                if min_cost_total > daily_range.max:
                    warning = {
                        "date": day.isoformat(),
                        "category_id": category_id,
                        "category_name": category.get("name"),
                        "reason": "最低成本高于预算上限",
                        "min_cost": str(round_decimal(min_cost_total, precision)),
                        "budget_max": str(daily_range.max),
                    }
                    warnings.append(warning)
                    day_warnings.append(warning)
                for product in chosen:
                    item_quantity_range = product.get("item_quantity_range") or {"min": 0}
                    quantity_step = quantity_step_for_unit(product.get("unit", ""))
                    min_qty = _min_quantity_for_product(item_quantity_range, quantity_step)
                    item = _build_item(product, category, precision, quantity_override=min_qty, rng=rng)
                    used_products.add(item["product_id"])
                    items.append(item)
                    daily_items.append(item)
                    daily_category_selected[category_id].append(product)

            if not items:
                continue

            if daily_items:
                daily_total = round_decimal(
                    sum((item["amount"] for item in daily_items), Decimal("0")),
                    precision,
                )
                if daily_total < daily_range.min:
                    for _ in range(MAX_DAILY_MIN_ADD_TRIES):
                        if daily_total >= daily_range.min:
                            break
                        eligible_categories = [
                            category_id
                            for category_id, max_count in daily_category_limits.items()
                            if len(daily_category_selected[category_id]) < max_count
                        ]
                        if not eligible_categories:
                            break
                        category_id = rng.choice(eligible_categories)
                        candidates = daily_category_candidates.get(category_id, [])
                        remaining = [
                            p for p in candidates if str(p["_id"]) not in used_products
                        ]
                        if not remaining:
                            daily_category_limits[category_id] = len(daily_category_selected[category_id])
                            continue
                        product = rng.choice(remaining)
                        category = categories_by_id.get(category_id)
                        if not category:
                            continue
                        item_quantity_range = product.get("item_quantity_range") or {"min": 0}
                        quantity_step = quantity_step_for_unit(product.get("unit", ""))
                        min_qty = _min_quantity_for_product(item_quantity_range, quantity_step)
                        item = _build_item(product, category, precision, quantity_override=min_qty, rng=rng)
                        used_products.add(item["product_id"])
                        items.append(item)
                        daily_items.append(item)
                        daily_category_selected[category_id].append(product)
                        daily_total = round_decimal(
                            sum((itm["amount"] for itm in daily_items), Decimal("0")),
                            precision,
                        )
                _adjust_to_budget(daily_items, target_budget, precision)

            total_amount = round_decimal(sum((item["amount"] for item in items), Decimal("0")), precision)
            daily_total = round_decimal(sum((item["amount"] for item in daily_items), Decimal("0")), precision)
            if daily_total > daily_range.max:
                warning = {
                    "date": day.isoformat(),
                    "reason": "日采总额高于预算上限",
                    "total_amount": str(daily_total),
                    "budget_max": str(daily_range.max),
                }
                warnings.append(warning)
                day_warnings.append(warning)
            if daily_total < daily_range.min:
                warning = {
                    "date": day.isoformat(),
                    "reason": "日采总额低于预算下限",
                    "total_amount": str(daily_total),
                    "budget_min": str(daily_range.min),
                }
                warnings.append(warning)
                day_warnings.append(warning)
            plan = {
                "date": day.isoformat(),
                "year_month": f"{year}-{month:02d}",
                "total_amount": total_amount,
                "items": _cleanup_items(items),
                "warnings": day_warnings,
                "creator_id": creator_id,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }
            plans.append(plan)

    return plans, warnings
