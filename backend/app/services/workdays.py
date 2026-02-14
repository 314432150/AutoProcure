"""工作日服务。

支持三种来源：交易日历库、本地工作日接口、工作日规则回退。
用于采购计划生成时的工作日计算与日期对齐。
"""
from datetime import date, timedelta
import calendar

import httpx
import pandas_market_calendars as mcal
from fastapi import HTTPException

from app.core.config import config


def _default_workdays(year: int, month: int) -> list[date]:
    """按周一到周五生成默认工作日列表。"""
    last_day = calendar.monthrange(year, month)[1]
    days: list[date] = []
    for day in range(1, last_day + 1):
        current = date(year, month, day)
        if current.weekday() < 5:
            days.append(current)
    return days


def _calendar_workdays(year: int, month: int) -> list[date]:
    """使用 pandas_market_calendars 获取指定月份工作日。"""
    try:
        exchange_calendar = mcal.get_calendar(config.workday_calendar)
    except Exception as exc:  # pragma: no cover - calendar lookup failure
        if config.workday_fallback:
            # 日历库异常时回退为默认工作日
            return _default_workdays(year, month)
        raise HTTPException(status_code=502, detail=f"交易日历不可用：{exc}") from exc

    start = date(year, month, 1)
    end = date(year, month, calendar.monthrange(year, month)[1])
    schedule = exchange_calendar.schedule(start_date=start, end_date=end)
    # 将交易日索引转换为日期列表
    days = [d.date() for d in schedule.index]
    return sorted(days)


async def get_workdays(year: int, month: int) -> list[date]:
    """根据配置获取工作日列表，必要时回退到默认工作日。"""
    if config.workday_provider == "pandas_market_calendars":
        return _calendar_workdays(year, month)

    if not config.workday_api_url:
        if config.workday_fallback:
            # 未配置接口时回退为默认工作日
            return _default_workdays(year, month)
        raise HTTPException(status_code=502, detail="工作日接口未配置")

    params: dict[str, int | str] = {"year": year, "month": month}
    if config.workday_api_key:
        params["key"] = config.workday_api_key

    try:
        async with httpx.AsyncClient(timeout=config.workday_api_timeout) as client:
            response = await client.get(config.workday_api_url, params=params)
            response.raise_for_status()
            payload = response.json()
    except httpx.HTTPError as exc:
        if config.workday_fallback:
            # 接口异常时回退为默认工作日
            return _default_workdays(year, month)
        raise HTTPException(status_code=502, detail=f"工作日接口错误：{exc}") from exc

    workdays = payload.get("workdays")
    if not isinstance(workdays, list):
        if config.workday_fallback:
            # 返回结构不符合预期时回退
            return _default_workdays(year, month)
        raise HTTPException(status_code=502, detail="工作日接口返回数据无效")

    parsed: list[date] = []
    for item in workdays:
        try:
            parts = [int(p) for p in str(item).split("-")]
            parsed.append(date(parts[0], parts[1], parts[2]))
        except (ValueError, IndexError):
            # 忽略无法解析的日期
            continue

    if not parsed and config.workday_fallback:
        # 解析失败且允许回退时使用默认工作日
        return _default_workdays(year, month)

    return sorted(parsed)


def shift_to_next_workday(target: date, workdays: list[date]) -> date | None:
    """将目标日期向后顺延到最近的工作日。"""
    for day in workdays:
        if day >= target:
            return day
    return None
