"""工作日接口测试。"""

from datetime import date

import pytest

import app.routers.workdays as workdays_router


@pytest.mark.asyncio
async def test_workdays_endpoint(client, auth_header, monkeypatch):
    """验证工作日接口返回指定日期列表。"""
    async def fake_workdays(year: int, month: int):
        """模拟工作日服务返回固定日期。"""
        return [date(year, month, 5)]

    monkeypatch.setattr(workdays_router, "fetch_workdays", fake_workdays)

    resp = await client.get("/api/workdays", params={"year": 2026, "month": 2}, headers=auth_header)
    payload = resp.json()
    assert payload["code"] == 2000
    assert payload["data"]["workdays"] == ["2026-02-05"]
