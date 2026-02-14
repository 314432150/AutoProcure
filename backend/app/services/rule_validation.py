"""规则校验服务。

用于识别品类规则缺失或规则与产品不匹配的情况，供后端校验与前端提示。
"""

from collections.abc import Iterable


async def collect_rule_gaps(db) -> dict:
    """收集品类规则缺口，返回缺少规则或缺少产品的品类列表。"""
    categories = await db["categories"].find({}).to_list(1000)
    name_to_id = {doc.get("name"): str(doc.get("_id")) for doc in categories if doc.get("name")}

    product_cursor = db["products"].find(
        {"is_deleted": False},
        {"category_id": 1, "category_name": 1, "category": 1},
    )

    product_categories = await _collect_categories(product_cursor, name_to_id)
    rule_categories: set[str] = set()
    for doc in categories:
        purchase_mode = doc.get("purchase_mode")
        if purchase_mode not in {"daily", "periodic"}:
            # 未配置采购模式不纳入规则范围
            continue
        if not doc.get("items_count_range"):
            # 缺少选品数量范围视为未配置规则
            continue
        if purchase_mode == "periodic" and (doc.get("cycle_days") is None or doc.get("float_days") is None):
            # 定期采购缺少周期配置视为未配置规则
            continue
        rule_categories.add(str(doc["_id"]))

    categories_without_rules = sorted(product_categories - rule_categories)
    categories_without_products = sorted(rule_categories - product_categories)

    return {
        "categories_without_rules": categories_without_rules,
        "categories_without_products": categories_without_products,
    }


async def _collect_categories(cursor, name_to_id: dict[str, str] | None) -> set[str]:
    """从产品游标中提取关联的品类编号集合，兼容历史字段。"""
    categories: set[str] = set()
    async for doc in cursor:
        category = doc.get("category_id")
        if not category and doc.get("_id"):
            category = str(doc.get("_id"))
        if not category and name_to_id:
            legacy_name = doc.get("category_name") or doc.get("category")
            category = name_to_id.get(legacy_name)
        if category:
            categories.add(category)
    return categories
