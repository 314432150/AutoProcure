"""采购计划生成与导出测试。"""

from datetime import date

import pytest

import app.services.procurement_generator as generator


@pytest.mark.asyncio
async def test_generate_and_export(client, auth_header, monkeypatch):
    """验证生成计划后可正常导出 ZIP。"""
    async def fake_workdays(year: int, month: int):
        """模拟工作日列表。"""
        return [date(year, month, 3), date(year, month, 4)]

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
            "daily_budget_range": {"min": "100", "max": "200"},
        },
        headers=auth_header,
    )

    category = await client.post("/api/categories", json={"name": "蔬菜"}, headers=auth_header)
    category_id = category.json()["data"]["id"]

    await client.post(
        "/api/products",
        json={
            "name": "青菜",
            "category_id": category_id,
            "unit": "斤",
            "base_price": "3.0",
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

    resp = await client.post(
        "/api/procurement/generate",
        params={"start_year": 2026, "start_month": 2, "end_year": 2026, "end_month": 2},
        headers=auth_header,
    )
    assert resp.json()["data"]["status"] == "成功"

    resp = await client.post(
        "/api/procurement/exports",
        params={"start_year": 2026, "start_month": 2, "end_year": 2026, "end_month": 2},
        headers=auth_header,
    )
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("application/zip")


@pytest.mark.asyncio
async def test_export_without_data_should_conflict(client, auth_header):
    """无计划数据时导出应返回冲突提示，而不是空压缩包。"""
    resp = await client.post(
        "/api/procurement/exports",
        params={"start_year": 2026, "start_month": 2, "end_year": 2026, "end_month": 2},
        headers=auth_header,
    )
    assert resp.status_code == 409
    assert "无采购计划数据" in resp.json()["message"]


@pytest.mark.asyncio
async def test_export_preview_precision_matches_export_rules(client, auth_header, db):
    """预览接口应使用与导出一致的金额精度与小计规则。"""
    await db["settings"].update_one(
        {"key": "global"},
        {"$set": {"key": "global", "export_precision": 1}},
        upsert=True,
    )

    await db["procurement_plans"].insert_one(
        {
            "date": "2026-02-03",
            "year_month": "2026-02",
            "total_amount": "2.0",
            "items": [
                {"name": "物资A", "price": "2.345", "quantity": "1", "amount": "0.04"},
                {"name": "物资B", "price": "1.2", "quantity": "1", "amount": "1.26"},
            ],
        }
    )

    resp = await client.get(
        "/api/procurement/exports/preview",
        params={"year": 2026, "month": 2, "max_rows": 1},
        headers=auth_header,
    )
    payload = resp.json()["data"]
    assert payload["precision"] == 1
    assert payload["month_total"] == "1.4"
    assert len(payload["rows"]) == 1

    row = payload["rows"][0]
    assert row["date_text"] == "02月03日"
    assert row["day_total"] == "1.4"
    assert "物资A0.1元" in row["items_text"]
    assert "物资B1.3元" in row["items_text"]
