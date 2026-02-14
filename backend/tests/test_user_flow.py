"""端到端用户流程测试。"""

from datetime import date

import pytest

import app.services.procurement_generator as generator


@pytest.mark.asyncio
async def test_user_flow_end_to_end(client, auth_header, monkeypatch):
    """验证从配置到生成与查询的完整流程。"""
    async def fake_workdays(year: int, month: int):
        """模拟固定的工作日列表。"""
        return [date(year, month, 3), date(year, month, 4)]

    monkeypatch.setattr(generator, "get_workdays", fake_workdays)

    resp = await client.put(
        "/api/procurement/exports/settings",
        json={
            "export_precision": 2,
        },
        headers=auth_header,
    )
    assert resp.json()["code"] == 2000
    resp = await client.put(
        "/api/procurement/settings",
        json={
            "daily_budget_range": {"min": "100", "max": "200"},
        },
        headers=auth_header,
    )
    assert resp.json()["code"] == 2000

    category_ids = {}
    for name in ["蔬菜", "水果", "肉蛋禽"]:
        resp = await client.post("/api/categories", json={"name": name}, headers=auth_header)
        category_ids[name] = resp.json()["data"]["id"]

    products = [
        {
            "name": "白菜",
            "category_id": category_ids["蔬菜"],
            "unit": "斤",
            "base_price": "3.0",
            "volatility": "0.05",
            "item_quantity_range": {"min": "1", "max": "2"},
            "quantity_step": "0.1",
        },
        {
            "name": "苹果",
            "category_id": category_ids["水果"],
            "unit": "斤",
            "base_price": "6.5",
            "volatility": "0.05",
            "item_quantity_range": {"min": "1", "max": "2"},
            "quantity_step": "0.1",
        },
        {
            "name": "猪肉",
            "category_id": category_ids["肉蛋禽"],
            "unit": "斤",
            "base_price": "28.0",
            "volatility": "0.05",
            "item_quantity_range": {"min": "1", "max": "2"},
            "quantity_step": "0.1",
        },
    ]
    for product in products:
        resp = await client.post("/api/products", json=product, headers=auth_header)
        assert resp.json()["code"] == 2000

    for name, category_id in category_ids.items():
        resp = await client.put(
            f"/api/categories/{category_id}",
            json={
                "purchase_mode": "daily",
                "items_count_range": {"min": 1, "max": 1},
            },
            headers=auth_header,
        )
        assert resp.json()["code"] == 2000

    resp = await client.post(
        "/api/procurement/generate",
        params={"start_year": 2026, "start_month": 2, "end_year": 2026, "end_month": 2},
        headers=auth_header,
    )
    assert resp.json()["data"]["status"] == "成功"

    resp = await client.get(
        "/api/procurement/plans",
        params={"year": 2026, "month": 2},
        headers=auth_header,
    )
    payload = resp.json()["data"]
    assert payload["total"] > 0
    plan_date = payload["items"][0]["date"]

    resp = await client.get(f"/api/procurement/plans/{plan_date}", headers=auth_header)
    plan = resp.json()["data"]

    resp = await client.put(
        f"/api/procurement/plans/{plan_date}",
        json={"items": plan["items"], "total_amount": plan["total_amount"]},
        headers=auth_header,
    )
    assert resp.json()["data"]["status"] == "成功"

    resp = await client.get(
        "/api/procurement/history",
        params={"year": 2026, "month": 2},
        headers=auth_header,
    )
    assert resp.json()["data"]["total"] > 0

    resp = await client.get("/api/procurement/summary", params={"year": 2026}, headers=auth_header)
    assert len(resp.json()["data"]["items"]) > 0

    resp = await client.post(
        "/api/procurement/exports",
        params={"start_year": 2026, "start_month": 2, "end_year": 2026, "end_month": 2},
        headers=auth_header,
    )
    assert resp.status_code == 200
