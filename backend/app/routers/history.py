"""历史查询接口。

提供采购计划历史列表与按月汇总功能。
"""
from typing import Any

from fastapi import APIRouter, Query

from app.core.response import ok
from app.db.mongo import get_database

router = APIRouter(prefix="/api/procurement", tags=["history"])


@router.get("/history")
async def history(
    year: int | None = None,
    month: int | None = None,
    keyword: str | None = None,
    category: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    """按条件查询历史采购记录。"""
    db = get_database()
    query: dict[str, Any] = {}

    if year and month:
        query["year_month"] = f"{year}-{month:02d}"
    elif year:
        query["year_month"] = {"$regex": f"^{year}-"}

    if keyword:
        query["items.name"] = {"$regex": keyword, "$options": "i"}

    if category:
        product_cursor = db["products"].find(
            {"category_id": category, "is_deleted": False},
            {"_id": 1},
        )
        product_ids: list[str] = [str(doc["_id"]) async for doc in product_cursor]
        or_filters: list[dict[str, Any]] = [{"items.category_id": category}]
        if product_ids:
            or_filters.append({"items.product_id": {"$in": product_ids}})
        query["$or"] = or_filters

    skip = max(page - 1, 0) * page_size
    cursor = db["procurement_plans"].find(query).skip(skip).limit(page_size).sort("date", -1)
    items = [
        {"date": doc.get("date"), "total_amount": doc.get("total_amount")}
        async for doc in cursor
    ]
    total = await db["procurement_plans"].count_documents(query)
    return ok({"items": items, "total": total})


@router.get("/summary")
async def summary(year: int = Query(...)) -> dict:
    """按年统计每月采购总额。"""
    db = get_database()
    pipeline = [
        {"$match": {"year_month": {"$regex": f"^{year}-"}}},
        {"$group": {"_id": "$year_month", "total_amount": {"$sum": "$total_amount"}}},
        {"$sort": {"_id": 1}},
    ]
    items = []
    async for doc in db["procurement_plans"].aggregate(pipeline):
        items.append({"month": doc["_id"], "total_amount": doc["total_amount"]})
    return ok({"items": items})
