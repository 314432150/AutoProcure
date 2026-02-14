"""工作日查询接口。

提供指定年月的工作日列表。
"""
from fastapi import APIRouter, Query

from app.core.response import ok
from app.services.workdays import get_workdays as fetch_workdays

router = APIRouter(prefix="/api/workdays", tags=["workdays"])


@router.get("")
async def get_workdays(year: int = Query(...), month: int = Query(...)) -> dict:
    """返回指定年月的工作日日期列表。"""
    workdays = await fetch_workdays(year, month)
    payload = [day.isoformat() for day in workdays]
    return ok({"workdays": payload})
