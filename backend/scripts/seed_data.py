"""初始化数据脚本。

写入默认品类、产品、采购计划与系统配置，便于本地开发调试。
"""

import argparse
import asyncio
from datetime import datetime
from zoneinfo import ZoneInfo
from decimal import Decimal
from typing import Any, cast
import random

from app.core.config import config
from app.core.security import hash_password
from app.db.mongo import get_database
from app.db.serializers import encode_for_mongo
from app.services.procurement_generator import generate_plans


def _build_products(scale: int) -> list[dict]:
    """按规模生成默认产品数据。"""
    categories = {
        "早餐": {
            "price": (2.0, 6.0),
            "items": [
                {"name": "包子", "unit": "份"},
                {"name": "馒头", "unit": "份"},
                {"name": "油条", "unit": "根"},
                {"name": "豆浆", "unit": "杯"},
                {"name": "粥", "unit": "碗"},
                {"name": "花卷", "unit": "份"},
                {"name": "烧麦", "unit": "份"},
                {"name": "饺子", "unit": "份"},
                {"name": "锅贴", "unit": "份"},
                {"name": "鸡蛋饼", "unit": "份"},
                {"name": "面包", "unit": "个"},
                {"name": "牛奶", "unit": "盒"},
                {"name": "小米粥", "unit": "碗"},
                {"name": "玉米粥", "unit": "碗"},
            ],
        },
        "蔬菜": {
            "price": (2.0, 6.0),
            "items": [
                {"name": "白菜", "unit": "斤"},
                {"name": "青菜", "unit": "斤"},
                {"name": "菠菜", "unit": "斤"},
                {"name": "土豆", "unit": "斤"},
                {"name": "西红柿", "unit": "斤"},
                {"name": "黄瓜", "unit": "斤"},
                {"name": "胡萝卜", "unit": "斤"},
                {"name": "茄子", "unit": "斤"},
                {"name": "豆角", "unit": "斤"},
                {"name": "青椒", "unit": "斤"},
                {"name": "洋葱", "unit": "斤"},
                {"name": "大蒜", "unit": "斤"},
                {"name": "生姜", "unit": "斤"},
                {"name": "南瓜", "unit": "斤"},
                {"name": "冬瓜", "unit": "斤"},
                {"name": "苦瓜", "unit": "斤"},
                {"name": "西葫芦", "unit": "斤"},
                {"name": "菜花", "unit": "斤"},
                {"name": "西兰花", "unit": "斤"},
                {"name": "莴笋", "unit": "斤"},
                {"name": "芹菜", "unit": "斤"},
                {"name": "韭菜", "unit": "斤"},
                {"name": "生菜", "unit": "斤"},
                {"name": "包菜", "unit": "斤"},
                {"name": "白萝卜", "unit": "斤"},
                {"name": "莲藕", "unit": "斤"},
                {"name": "山药", "unit": "斤"},
                {"name": "芋头", "unit": "斤"},
                {"name": "蘑菇", "unit": "斤"},
                {"name": "金针菇", "unit": "斤"},
            ],
        },
        "水果": {
            "price": (3.0, 12.0),
            "items": [
                {"name": "苹果", "unit": "斤"},
                {"name": "香蕉", "unit": "斤"},
                {"name": "橙子", "unit": "斤"},
                {"name": "梨", "unit": "斤"},
                {"name": "葡萄", "unit": "斤"},
                {"name": "西瓜", "unit": "斤"},
                {"name": "哈密瓜", "unit": "斤"},
                {"name": "草莓", "unit": "斤"},
                {"name": "蓝莓", "unit": "斤"},
                {"name": "猕猴桃", "unit": "斤"},
                {"name": "桃子", "unit": "斤"},
                {"name": "李子", "unit": "斤"},
                {"name": "柚子", "unit": "斤"},
                {"name": "菠萝", "unit": "斤"},
                {"name": "芒果", "unit": "斤"},
                {"name": "火龙果", "unit": "斤"},
            ],
        },
        "豆制品": {
            "price": (3.0, 8.0),
            "items": [
                {"name": "豆腐", "unit": "斤"},
                {"name": "豆干", "unit": "斤"},
                {"name": "豆皮", "unit": "斤"},
                {"name": "腐竹", "unit": "斤"},
                {"name": "豆浆", "unit": "斤"},
                {"name": "豆花", "unit": "斤"},
                {"name": "豆腐脑", "unit": "斤"},
                {"name": "千张", "unit": "斤"},
                {"name": "香干", "unit": "斤"},
                {"name": "毛豆", "unit": "斤"},
                {"name": "黄豆", "unit": "斤"},
                {"name": "绿豆", "unit": "斤"},
                {"name": "黑豆", "unit": "斤"},
                {"name": "豆腐乳", "unit": "瓶"},
                {"name": "豆筋", "unit": "斤"},
                {"name": "素鸡", "unit": "斤"},
            ],
        },
        "肉蛋禽": {
            "price": (12.0, 38.0),
            "items": [
                {"name": "猪肉", "unit": "斤"},
                {"name": "牛肉", "unit": "斤"},
                {"name": "鸡肉", "unit": "斤"},
                {"name": "鸭肉", "unit": "斤"},
                {"name": "鸡蛋", "unit": "个"},
                {"name": "鸭蛋", "unit": "个"},
                {"name": "鹌鹑蛋", "unit": "斤"},
                {"name": "猪里脊", "unit": "斤"},
                {"name": "五花肉", "unit": "斤"},
                {"name": "排骨", "unit": "斤"},
                {"name": "牛腩", "unit": "斤"},
                {"name": "羊肉", "unit": "斤"},
                {"name": "鸡胸", "unit": "斤"},
                {"name": "鸡腿", "unit": "斤"},
                {"name": "鸡翅", "unit": "斤"},
                {"name": "鸭腿", "unit": "斤"},
                {"name": "鹅肉", "unit": "斤"},
                {"name": "肉丸", "unit": "斤"},
            ],
        },
        "水产": {
            "price": (10.0, 40.0),
            "items": [
                {"name": "鲫鱼", "unit": "斤"},
                {"name": "草鱼", "unit": "斤"},
                {"name": "鲤鱼", "unit": "斤"},
                {"name": "鲈鱼", "unit": "斤"},
                {"name": "鳊鱼", "unit": "斤"},
                {"name": "带鱼", "unit": "斤"},
                {"name": "黄花鱼", "unit": "斤"},
                {"name": "鲅鱼", "unit": "斤"},
                {"name": "鳕鱼", "unit": "斤"},
                {"name": "虾", "unit": "斤"},
                {"name": "基围虾", "unit": "斤"},
                {"name": "虾仁", "unit": "斤"},
                {"name": "鱿鱼", "unit": "斤"},
                {"name": "章鱼", "unit": "斤"},
                {"name": "扇贝", "unit": "斤"},
                {"name": "蛤蜊", "unit": "斤"},
                {"name": "生蚝", "unit": "斤"},
                {"name": "海带", "unit": "斤"},
            ],
        },
        "粮油调味": {
            "price": (5.0, 30.0),
            "items": [
                {"name": "食用油", "unit": "瓶"},
                {"name": "酱油", "unit": "瓶"},
                {"name": "醋", "unit": "瓶"},
                {"name": "盐", "unit": "包"},
                {"name": "味精", "unit": "包"},
                {"name": "白糖", "unit": "包"},
                {"name": "红糖", "unit": "包"},
                {"name": "料酒", "unit": "瓶"},
                {"name": "蚝油", "unit": "瓶"},
                {"name": "花椒", "unit": "包"},
                {"name": "八角", "unit": "包"},
                {"name": "香叶", "unit": "包"},
                {"name": "胡椒粉", "unit": "包"},
                {"name": "孜然", "unit": "包"},
                {"name": "大米", "unit": "斤"},
                {"name": "面粉", "unit": "斤"},
            ],
        },
        "日用耗材": {
            "price": (5.0, 25.0),
            "items": [
                {"name": "洗洁精", "unit": "瓶"},
                {"name": "洗手液", "unit": "瓶"},
                {"name": "抹布", "unit": "包"},
                {"name": "一次性手套", "unit": "盒"},
                {"name": "垃圾袋", "unit": "包"},
                {"name": "保鲜膜", "unit": "卷"},
                {"name": "保鲜袋", "unit": "包"},
                {"name": "清洁球", "unit": "包"},
                {"name": "海绵", "unit": "块"},
                {"name": "纸巾", "unit": "包"},
                {"name": "厨房纸", "unit": "包"},
                {"name": "洗衣液", "unit": "瓶"},
                {"name": "消毒液", "unit": "瓶"},
                {"name": "拖把", "unit": "把"},
                {"name": "扫帚", "unit": "把"},
            ],
        },
        "燃料": {
            "price": (80.0, 150.0),
            "items": [
                {"name": "液化气罐", "unit": "罐"},
            ],
        },
    }

    products: list[dict] = []
    random.seed(20260208)

    for category, meta in categories.items():
        for item in meta["items"]:
            products.append(
                {
                    "name": item["name"],
                    "category_name": category,
                    "unit": item["unit"],
                    "base_price": Decimal(str(random.randint(int(meta["price"][0]), int(meta["price"][1])))),
                    "is_deleted": False,
                }
            )

    target = max(scale, 100, len(products))
    suffix = 1
    while len(products) < target:
        for category, meta in categories.items():
            if len(products) >= target:
                break
            base_items = meta["items"]
            base_item = base_items[suffix % len(base_items)]
            name = f"{base_item['name']}-{suffix:03d}"
            products.append(
                {
                    "name": name,
                    "category_name": category,
                    "unit": base_item["unit"],
                    "base_price": Decimal(str(random.randint(int(meta["price"][0]), int(meta["price"][1])))),
                    "is_deleted": False,
                }
            )
            suffix += 1

    return products


def _build_category_configs() -> list[dict]:
    """生成默认品类规则配置。"""
    return [
        {
            "category_name": "早餐",
            "purchase_mode": "daily",
            "items_count_range": {"min": 2, "max": 4},
            "product_volatility": Decimal("0.05"),
            "product_item_quantity_range": {"min": Decimal("5"), "max": Decimal("30")},
        },
        {
            "category_name": "蔬菜",
            "purchase_mode": "daily",
            "items_count_range": {"min": 3, "max": 5},
            "product_volatility": Decimal("0.15"),
            "product_item_quantity_range": {"min": Decimal("10"), "max": Decimal("30")},
        },
        {
            "category_name": "水果",
            "purchase_mode": "daily",
            "items_count_range": {"min": 1, "max": 3},
            "product_volatility": Decimal("0.12"),
            "product_item_quantity_range": {"min": Decimal("5"), "max": Decimal("20")},
        },
        {
            "category_name": "豆制品",
            "purchase_mode": "daily",
            "items_count_range": {"min": 1, "max": 2},
            "product_volatility": Decimal("0.10"),
            "product_item_quantity_range": {"min": Decimal("4"), "max": Decimal("15")},
        },
        {
            "category_name": "肉蛋禽",
            "purchase_mode": "daily",
            "items_count_range": {"min": 2, "max": 4},
            "product_volatility": Decimal("0.08"),
            "product_item_quantity_range": {"min": Decimal("8"), "max": Decimal("25")},
        },
        {
            "category_name": "水产",
            "purchase_mode": "daily",
            "items_count_range": {"min": 1, "max": 2},
            "product_volatility": Decimal("0.10"),
            "product_item_quantity_range": {"min": Decimal("6"), "max": Decimal("20")},
        },
        {
            "category_name": "粮油调味",
            "purchase_mode": "periodic",
            "cycle_days": 20,
            "float_days": 3,
            "items_count_range": {"min": 1, "max": 2},
            "product_volatility": Decimal("0.02"),
            "product_item_quantity_range": {"min": Decimal("1"), "max": Decimal("5")},
        },
        {
            "category_name": "日用耗材",
            "purchase_mode": "periodic",
            "cycle_days": 30,
            "float_days": 5,
            "items_count_range": {"min": 1, "max": 2},
            "product_volatility": Decimal("0.03"),
            "product_item_quantity_range": {"min": Decimal("1"), "max": Decimal("6")},
        },
        {
            "category_name": "燃料",
            "purchase_mode": "periodic",
            "cycle_days": 30,
            "float_days": 3,
            "items_count_range": {"min": 1, "max": 1},
            "product_volatility": Decimal("0.00"),
            "product_item_quantity_range": {"min": Decimal("1"), "max": Decimal("2")},
        },
    ]


def _build_settings() -> dict:
    """生成默认系统设置配置。"""
    return {
        "export_precision": 2,
        "daily_budget_range": {"min": Decimal("200"), "max": Decimal("400")},
    }


async def seed_data(year: int, scale: int, wipe: bool) -> None:
    """写入初始化数据到数据库。"""
    db = get_database()
    if wipe:
        await db["products"].delete_many({})
        await db["categories"].delete_many({})
        await db["settings"].delete_many({})
        await db["procurement_plans"].delete_many({})
        await db["users"].delete_many({})

    now = datetime.now(ZoneInfo("Asia/Shanghai")).replace(tzinfo=None)
    user = {
        "username": "admin",
        "full_name": "管理员",
        "password_hash": hash_password("admin123"),
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    }
    user_id = str((await db["users"].insert_one(user)).inserted_id)

    products = _build_products(scale)
    category_names = sorted({product["category_name"] for product in products if product.get("category_name")})
    category_docs = [
        {"name": name, "is_active": True, "created_at": now, "updated_at": now}
        for name in category_names
    ]
    category_result = await db["categories"].insert_many(encode_for_mongo(category_docs))
    category_ids = {
        name: str(category_result.inserted_ids[idx])
        for idx, name in enumerate(category_names)
    }

    configs = _build_category_configs()
    config_map = {config["category_name"]: config for config in configs}
    for name, category_id in category_ids.items():
        config = config_map.get(name)
        if not config:
            continue
        update = {
            "purchase_mode": config.get("purchase_mode"),
            "cycle_days": config.get("cycle_days"),
            "float_days": config.get("float_days"),
            "items_count_range": config.get("items_count_range"),
            "updated_at": now,
        }
        await db["categories"].update_one(
            {"_id": category_result.inserted_ids[category_names.index(name)]},
            {"$set": encode_for_mongo(update)},
        )

    for product in products:
        product["category_id"] = category_ids.get(product.get("category_name", ""), "")
        config = config_map.get(product.get("category_name", ""))
        if config:
            product["volatility"] = config.get("product_volatility", Decimal("0"))
            product["item_quantity_range"] = config.get("product_item_quantity_range")
        product["created_at"] = now
        product["updated_at"] = now
    await db["products"].insert_many(encode_for_mongo(products))

    settings = _build_settings()
    encoded_settings = cast(dict[str, Any], encode_for_mongo(settings))
    await db["settings"].update_one(
        {"key": "global"},
        {"$set": {**encoded_settings, "key": "global", "updated_at": now}, "$setOnInsert": {"created_at": now}},
        upsert=True,
    )

    daily_range = settings.get("daily_budget_range")
    plans: list[dict] = []
    if daily_range and daily_range.get("min") is not None and daily_range.get("max") is not None:
        for month in range(1, 13):
            month_plans = await generate_plans(db, year, month, year, month, creator_id=user_id)
            if month_plans:
                plans.extend(month_plans)

    if plans:
        encoded_plans = cast(list[dict[str, Any]], encode_for_mongo(plans))
        await db["procurement_plans"].insert_many(encoded_plans)

    print(f"已写入用户=admin/admin123，产品={len(products)}，品类={len(category_ids)}，计划={len(plans)}")


def main() -> None:
    """脚本入口函数。"""
    parser = argparse.ArgumentParser()
    parser.add_argument("--year", type=int, default=2026)
    parser.add_argument("--scale", type=int, default=100)
    parser.add_argument("--wipe", action="store_true")
    args = parser.parse_args()

    asyncio.run(seed_data(args.year, args.scale, args.wipe))


if __name__ == "__main__":
    main()
