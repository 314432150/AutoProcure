"""测试通用夹具配置。"""

from datetime import datetime
import os
import sys

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from mongomock_motor import AsyncMongoMockClient

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from app.core.security import hash_password
from app.main import app

import app.db.mongo as mongo
import app.core.security as security
import app.routers.products as products_router
import app.routers.procurement as procurement_router
import app.routers.history as history_router
import app.routers.procurement_export as procurement_export_router
import app.routers.auth as auth_router
import app.routers.categories as categories_router


@pytest_asyncio.fixture
async def db(monkeypatch):
    """提供内存 MongoDB 并替换数据库依赖。"""
    client = AsyncMongoMockClient()
    db = client["testdb"]

    def _get_db():
        """返回测试数据库实例。"""
        return db

    monkeypatch.setattr(mongo, "get_database", _get_db)
    monkeypatch.setattr(security, "get_database", _get_db)
    monkeypatch.setattr(products_router, "get_database", _get_db)
    monkeypatch.setattr(procurement_router, "get_database", _get_db)
    monkeypatch.setattr(history_router, "get_database", _get_db)
    monkeypatch.setattr(procurement_export_router, "get_database", _get_db)
    monkeypatch.setattr(auth_router, "get_database", _get_db)
    monkeypatch.setattr(categories_router, "get_database", _get_db)

    return db


@pytest_asyncio.fixture
async def client(db):
    """提供基于 ASGI 的异步测试客户端。"""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as http_client:
        yield http_client


@pytest_asyncio.fixture
async def seeded_user(db):
    """写入默认管理员用户用于测试登录。"""
    now = datetime.utcnow()
    user = {
        "username": "admin",
        "full_name": "管理员",
        "password_hash": hash_password("secret"),
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    }
    result = await db["users"].insert_one(user)
    user_id = str(result.inserted_id)
    return {**user, "id": user_id}


@pytest_asyncio.fixture
async def auth_header(client, seeded_user):
    """返回带认证令牌的请求头。"""
    resp = await client.post("/api/auth/login", json={"username": "admin", "password": "secret"})
    token = resp.json()["data"]["token"]
    return {"Authorization": f"Bearer {token}"}
