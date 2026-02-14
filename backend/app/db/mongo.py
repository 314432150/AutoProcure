"""MongoDB 连接管理。"""

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.core.config import config


_client: AsyncIOMotorClient | None = None


def get_client() -> AsyncIOMotorClient:
    """获取 Mongo 客户端单例。"""
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(
            config.mongo_uri,
            serverSelectionTimeoutMS=config.mongo_server_selection_timeout_ms,
        )
    return _client


def get_database() -> AsyncIOMotorDatabase:
    """获取默认数据库连接。"""
    return get_client()[config.mongo_db]
