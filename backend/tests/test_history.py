"""历史查询接口测试。"""

import pytest


@pytest.mark.asyncio
async def test_history_empty(client, auth_header):
    """验证历史查询在无数据时返回空结果。"""
    resp = await client.get("/api/procurement/history", headers=auth_header)
    payload = resp.json()
    assert payload["code"] == 2000
    assert payload["data"]["total"] == 0
