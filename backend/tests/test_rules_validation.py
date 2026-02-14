"""定期采购规则校验测试。"""

import pytest


@pytest.mark.asyncio
async def test_periodic_rule_requires_cycle(client, auth_header):
    """验证定期采购未配置周期会被拒绝。"""
    category = await client.post("/api/categories", json={"name": "燃料"}, headers=auth_header)
    category_id = category.json()["data"]["id"]

    resp = await client.put(
        f"/api/categories/{category_id}",
        json={
            "purchase_mode": "periodic",
            "items_count_range": {"min": 1, "max": 1},
        },
        headers=auth_header,
    )
    assert resp.json()["code"] == 4000
