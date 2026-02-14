"""系统设置接口测试。"""

import pytest


@pytest.mark.asyncio
async def test_settings_precision_validation(client, auth_header):
    """验证金额精度超范围会返回错误。"""
    resp = await client.put(
        "/api/procurement/exports/settings",
        json={
            "export_precision": 7,
        },
        headers=auth_header,
    )
    payload = resp.json()
    assert payload["code"] == 4000
