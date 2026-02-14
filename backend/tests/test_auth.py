"""认证接口测试。"""

import pytest


@pytest.mark.asyncio
async def test_login_success(client, seeded_user):
    """验证正确账号密码能够登录成功。"""
    resp = await client.post("/api/auth/login", json={"username": "admin", "password": "secret"})
    payload = resp.json()
    assert payload["code"] == 2000
    assert payload["data"]["token"]


@pytest.mark.asyncio
async def test_login_invalid(client, seeded_user):
    """验证错误密码会返回认证失败。"""
    resp = await client.post("/api/auth/login", json={"username": "admin", "password": "bad"})
    payload = resp.json()
    assert payload["code"] == 4001
