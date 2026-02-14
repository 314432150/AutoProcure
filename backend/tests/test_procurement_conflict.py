"""采购计划冲突测试。"""

from datetime import date

import pytest

import app.services.procurement_generator as generator


@pytest.mark.asyncio
async def test_generate_conflict(client, auth_header, monkeypatch):
    """验证重复生成同月计划会返回冲突。"""
    async def fake_workdays(year: int, month: int):
        """构造仅含单个工作日的日期列表。"""
        return [date(year, month, 6)]

    monkeypatch.setattr(generator, "get_workdays", fake_workdays)

    await client.put(
        "/api/procurement/exports/settings",
        json={
            "export_precision": 2,
        },
        headers=auth_header,
    )
    await client.put(
        "/api/procurement/settings",
        json={
            "daily_budget_range": {"min": "50", "max": "60"},
        },
        headers=auth_header,
    )

    category = await client.post("/api/categories", json={"name": "蔬菜"}, headers=auth_header)
    category_id = category.json()["data"]["id"]

    await client.post(
        "/api/products",
        json={
            "name": "萝卜",
            "category_id": category_id,
            "unit": "斤",
            "base_price": "2.0",
            "volatility": "0.0",
            "item_quantity_range": {"min": "1", "max": "2"},
            "quantity_step": "0.1",
        },
        headers=auth_header,
    )

    await client.put(
        f"/api/categories/{category_id}",
        json={
            "purchase_mode": "daily",
            "items_count_range": {"min": 1, "max": 1},
        },
        headers=auth_header,
    )

    await client.post(
        "/api/procurement/generate",
        params={"start_year": 2026, "start_month": 2, "end_year": 2026, "end_month": 2},
        headers=auth_header,
    )

    resp = await client.post(
        "/api/procurement/generate",
        params={"start_year": 2026, "start_month": 2, "end_year": 2026, "end_month": 2},
        headers=auth_header,
    )
    assert resp.json()["data"]["status"] == "冲突"
