"""安全与鉴权工具。

负责密码加密、令牌签发与解析、当前用户解析。
"""

from datetime import datetime, timedelta

import jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from bson import ObjectId
from pymongo.errors import PyMongoError

from app.core.config import config
from app.db.mongo import get_database

_pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
_bearer = HTTPBearer()


def hash_password(password: str) -> str:
    """对明文密码进行哈希。"""
    return _pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    """校验明文密码与哈希值是否匹配。"""
    return _pwd_context.verify(password, password_hash)


def create_access_token(subject: str, username: str) -> str:
    """生成访问令牌（JWT）。"""
    expire = datetime.utcnow() + timedelta(minutes=config.jwt_expires_minutes)
    payload = {"sub": subject, "username": username, "exp": expire}
    return jwt.encode(payload, config.jwt_secret, algorithm=config.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    """解析并校验 JWT。"""
    try:
        return jwt.decode(token, config.jwt_secret, algorithms=[config.jwt_algorithm])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="无效令牌") from exc


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> dict:
    """从请求凭证中解析当前用户。"""
    payload = decode_access_token(credentials.credentials)
    return await get_user_from_payload(payload)


async def get_user_from_token(token: str) -> dict:
    """通过令牌字符串解析用户。"""
    payload = decode_access_token(token)
    return await get_user_from_payload(payload)


async def get_user_from_payload(payload: dict) -> dict:
    """从 JWT 载荷中读取用户并返回基础信息。"""
    user_id = payload.get("sub")
    if not user_id or not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=401, detail="令牌载荷无效")

    db = get_database()
    try:
        user = await db["users"].find_one({"_id": ObjectId(user_id), "is_active": True})
    except PyMongoError as exc:
        raise HTTPException(status_code=503, detail="数据库连接失败") from exc
    if not user:
        raise HTTPException(status_code=401, detail="用户不存在")

    user["id"] = str(user.pop("_id"))
    user.pop("password_hash", None)
    return user
