"""产品与品类规则测试。"""

import pytest


@pytest.mark.asyncio
async def test_product_crud(client, auth_header):
    """验证产品新增、查询、更新流程。"""
    category = await client.post("/api/categories", json={"name": "蔬菜"}, headers=auth_header)
    category_id = category.json()["data"]["id"]

    resp = await client.post(
        "/api/products",
        json={
            "name": "青菜",
            "category_id": category_id,
            "unit": "斤",
            "base_price": "3.5",
            "volatility": "0.05",
            "item_quantity_range": {"min": "1", "max": "2"},
            "quantity_step": "0.1",
        },
        headers=auth_header,
    )
    product_id = resp.json()["data"]["id"]

    resp = await client.get("/api/products", params={"is_active": True}, headers=auth_header)
    assert resp.json()["data"]["total"] == 1

    resp = await client.put(
        f"/api/products/{product_id}",
        json={"base_price": "4.0"},
        headers=auth_header,
    )
    assert resp.json()["data"]["status"] == "成功"

    resp = await client.delete(f"/api/products/{product_id}", headers=auth_header)
    assert resp.json()["data"]["status"] == "成功"


@pytest.mark.asyncio
async def test_rule_validation(client, auth_header):
    """验证品类规则缺口的校验结果。"""
    category = await client.post("/api/categories", json={"name": "蔬菜"}, headers=auth_header)
    category_id = category.json()["data"]["id"]

    await client.post(
        "/api/products",
        json={
            "name": "土豆",
            "category_id": category_id,
            "unit": "斤",
            "base_price": "2.0",
            "volatility": "0.05",
            "item_quantity_range": {"min": "1", "max": "2"},
            "quantity_step": "0.1",
        },
        headers=auth_header,
    )

    resp = await client.get("/api/categories/validation", headers=auth_header)
    gaps = resp.json()["data"]
    assert category_id in gaps["categories_without_rules"]

    resp = await client.put(
        f"/api/categories/{category_id}",
        json={
            "purchase_mode": "daily",
            "items_count_range": {"min": 1, "max": 1},
        },
        headers=auth_header,
    )
    assert resp.json()["code"] == 2000

    resp = await client.get("/api/categories/validation", headers=auth_header)
    gaps = resp.json()["data"]
    assert category_id not in gaps["categories_without_rules"]


@pytest.mark.asyncio
async def test_product_name_unique(client, auth_header):
    """验证产品名称唯一：新增重名/编辑改重名都应被拒绝。"""
    category = await client.post("/api/categories", json={"name": "蔬菜"}, headers=auth_header)
    category_id = category.json()["data"]["id"]

    first = await client.post(
        "/api/products",
        json={
            "name": "白菜",
            "category_id": category_id,
            "unit": "斤",
            "base_price": "2.5",
            "volatility": "0.05",
            "item_quantity_range": {"min": "1", "max": "2"},
            "quantity_step": "0.1",
        },
        headers=auth_header,
    )
    first_id = first.json()["data"]["id"]

    second = await client.post(
        "/api/products",
        json={
            "name": "土豆",
            "category_id": category_id,
            "unit": "斤",
            "base_price": "3.0",
            "volatility": "0.05",
            "item_quantity_range": {"min": "1", "max": "2"},
            "quantity_step": "0.1",
        },
        headers=auth_header,
    )
    second_id = second.json()["data"]["id"]

    dup_create = await client.post(
        "/api/products",
        json={
            "name": "白菜",
            "category_id": category_id,
            "unit": "斤",
            "base_price": "2.6",
            "volatility": "0.05",
            "item_quantity_range": {"min": "1", "max": "2"},
            "quantity_step": "0.1",
        },
        headers=auth_header,
    )
    assert dup_create.status_code == 409

    dup_update = await client.put(
        f"/api/products/{second_id}",
        json={"name": "白菜"},
        headers=auth_header,
    )
    assert dup_update.status_code == 409

    self_update = await client.put(
        f"/api/products/{first_id}",
        json={"name": "白菜"},
        headers=auth_header,
    )
    assert self_update.status_code == 200
