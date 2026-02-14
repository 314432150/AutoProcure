"""采购计划接口。

提供计划生成、列表查询、明细获取与计划更新/删除能力。
"""
from datetime import datetime
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.core.response import ok
from app.core.security import get_current_user
from app.db.mongo import get_database
from app.db.serializers import encode_for_mongo
from app.schemas.procurement_plan import ProcurementPlanItem
from app.schemas.settings import SettingsUpdate
from app.services.procurement_generator import generate_plans

router = APIRouter(prefix="/api/procurement", tags=["procurement"])


class PlanUpdate(BaseModel):
    items: list[ProcurementPlanItem]
    total_amount: Decimal


@router.get("/settings")
async def get_procurement_settings() -> dict:
    """获取采购计划相关设置（当前为预算区间）。"""
    db = get_database()
    doc = await db["settings"].find_one({"key": "global"})
    return ok({
        "daily_budget_range": (doc or {}).get("daily_budget_range"),
    })


@router.put("/settings")
async def update_procurement_settings(payload: SettingsUpdate) -> dict:
    """更新采购计划相关设置（当前为预算区间）。"""
    db = get_database()
    if payload.daily_budget_range and payload.daily_budget_range.min > payload.daily_budget_range.max:
        raise HTTPException(status_code=400, detail="日预算区间最小值不能大于最大值")

    now = datetime.utcnow()
    update = payload.model_dump(exclude={"created_at", "updated_at"}, exclude_none=True)
    update = encode_for_mongo(update)
    update["updated_at"] = now

    await db["settings"].update_one(
        {"key": "global"},
        {
            "$set": {**update, "key": "global"},
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
    )
    return ok({"status": "成功"})


@router.post("/generate")
async def generate_procurement_plans(
    start_year: int,
    start_month: int,
    end_year: int,
    end_month: int,
    force_overwrite: bool = False,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    """按年月范围生成采购计划，并处理覆盖冲突月份逻辑。"""
    db = get_database()

    if (start_year, start_month) > (end_year, end_month):
        raise HTTPException(status_code=400, detail="月份范围无效")
    if not (1 <= start_month <= 12 and 1 <= end_month <= 12):
        raise HTTPException(status_code=400, detail="月份值无效")
    if start_year < 2000 or end_year > 2100:
        raise HTTPException(status_code=400, detail="年份值无效")

    months = []
    current = datetime(start_year, start_month, 1)
    end = datetime(end_year, end_month, 1)
    while current <= end:
        months.append(f"{current.year}-{current.month:02d}")
        if current.month == 12:
            current = datetime(current.year + 1, 1, 1)
        else:
            current = datetime(current.year, current.month + 1, 1)

    # 检测冲突月份
    conflict = await db["procurement_plans"].distinct("year_month", {"year_month": {"$in": months}})
    if conflict and not force_overwrite:
        return ok({"status": "冲突", "conflict_months": conflict})

    if conflict and force_overwrite:
        # 覆盖模式下先删除冲突月份
        await db["procurement_plans"].delete_many({"year_month": {"$in": conflict}})

    plans, warnings = await generate_plans(
        db,
        start_year,
        start_month,
        end_year,
        end_month,
        creator_id=current_user.get("id"),
    )
    if plans:
        await db["procurement_plans"].insert_many(encode_for_mongo(plans))

    return ok({"status": "成功", "conflict_months": conflict, "warnings": warnings})


@router.get("/plans")
async def list_plans(
    year: int | None = None,
    month: int | None = None,
    start_year: int | None = None,
    start_month: int | None = None,
    end_year: int | None = None,
    end_month: int | None = None,
) -> dict:
    """获取指定月份或月份范围的每日计划列表。"""
    db = get_database()

    if start_year is not None or start_month is not None or end_year is not None or end_month is not None:
        if None in {start_year, start_month, end_year, end_month}:
            raise HTTPException(status_code=400, detail="月份范围参数不完整")
        if (start_year, start_month) > (end_year, end_month):
            raise HTTPException(status_code=400, detail="月份范围无效")
        if not (1 <= start_month <= 12 and 1 <= end_month <= 12):
            raise HTTPException(status_code=400, detail="月份值无效")
        months = []
        current = datetime(start_year, start_month, 1)
        end = datetime(end_year, end_month, 1)
        while current <= end:
            months.append(f"{current.year}-{current.month:02d}")
            if current.month == 12:
                current = datetime(current.year + 1, 1, 1)
            else:
                current = datetime(current.year, current.month + 1, 1)
        query = {"year_month": {"$in": months}}
    else:
        if year is None or month is None:
            raise HTTPException(status_code=400, detail="请提供查询月份")
        year_month = f"{year}-{month:02d}"
        query = {"year_month": year_month}

    cursor = db["procurement_plans"].find(query).sort("date", 1)
    items = [
        {
            "date": doc.get("date"),
            "year_month": doc.get("year_month"),
            "total_amount": doc.get("total_amount"),
            "warnings": doc.get("warnings", []),
            "updated_at": doc.get("updated_at"),
        }
        async for doc in cursor
    ]
    total = await db["procurement_plans"].count_documents(query)
    return ok({"items": items, "total": total})


@router.get("/plans/{plan_date}")
async def get_plan(plan_date: str) -> dict:
    """根据日期获取单日采购计划详情。"""
    db = get_database()
    doc = await db["procurement_plans"].find_one({"date": plan_date})
    if not doc:
        raise HTTPException(status_code=404, detail="未找到采购计划")
    doc["id"] = str(doc.pop("_id"))
    return ok(doc)


@router.put("/plans/{plan_date}")
async def update_plan(
    plan_date: str,
    payload: PlanUpdate,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    """更新单日采购计划明细与总金额。"""
    db = get_database()
    update = payload.model_dump()
    update = encode_for_mongo(update)
    update["updated_at"] = datetime.utcnow()
    update["updated_by"] = current_user.get("id")
    result = await db["procurement_plans"].update_one({"date": plan_date}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="未找到采购计划")
    return ok({"status": "成功", "date": plan_date})


@router.delete("/plans")
async def delete_month_plans(year: int = Query(...), month: int = Query(...)) -> dict:
    """删除指定月份的所有采购计划。"""
    db = get_database()
    year_month = f"{year}-{month:02d}"
    result = await db["procurement_plans"].delete_many({"year_month": year_month})
    return ok({"status": "成功", "deleted": result.deleted_count})
