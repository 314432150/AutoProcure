"""认证与用户接口。

提供登录、登出、个人资料与密码修改能力。
"""
from datetime import datetime
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.core.response import ok
from app.core.security import create_access_token, get_current_user, hash_password, verify_password
from app.db.mongo import get_database

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


class ProfileUpdateRequest(BaseModel):
    full_name: str | None = None


class PasswordUpdateRequest(BaseModel):
    current_password: str
    new_password: str


@router.post("/login")
async def login(payload: LoginRequest) -> JSONResponse:
    """校验账号密码并签发访问令牌。"""
    db = get_database()
    user = await db["users"].find_one({"username": payload.username, "is_active": True})
    if not user:
        raise HTTPException(status_code=401, detail="账号或密码错误")

    password_hash = user.get("password_hash")
    if not password_hash or not verify_password(payload.password, password_hash):
        raise HTTPException(status_code=401, detail="账号或密码错误")

    user_id = str(user["_id"])
    token = create_access_token(user_id, user.get("username", ""))
    await db["users"].update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"last_login": datetime.utcnow(), "updated_at": datetime.utcnow()}},
    )

    return ok(
        {
            "token": token,
            "expires_in": 60 * 60 * 24 * 7,
            "user_info": {
                "id": user_id,
                "username": user.get("username"),
                "full_name": user.get("full_name"),
            },
        }
    )


@router.post("/logout")
async def logout() -> JSONResponse:
    """登出接口（前端清理令牌即可）。"""
    return ok({"status": "成功"})


@router.get("/me")
async def me(current_user: dict[str, Any] = Depends(get_current_user)) -> JSONResponse:
    """返回当前登录用户信息。"""
    return ok({"user_info": current_user})


@router.put("/profile")
async def update_profile(
    payload: ProfileUpdateRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> JSONResponse:
    """更新用户基础资料。"""
    db = get_database()
    await db["users"].update_one(
        {"_id": ObjectId(current_user["id"])},
        {"$set": {"full_name": payload.full_name, "updated_at": datetime.utcnow()}},
    )
    user = await db["users"].find_one({"_id": ObjectId(current_user["id"])})
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    user["id"] = str(user.pop("_id"))
    user.pop("password_hash", None)
    return ok({"user_info": user})


@router.put("/password")
async def update_password(
    payload: PasswordUpdateRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> JSONResponse:
    """校验旧密码并更新新密码。"""
    db = get_database()
    user = await db["users"].find_one({"_id": ObjectId(current_user["id"])})
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    password_hash = user.get("password_hash")
    if not password_hash or not verify_password(payload.current_password, password_hash):
        raise HTTPException(status_code=400, detail="当前密码不正确")

    await db["users"].update_one(
        {"_id": ObjectId(current_user["id"])},
        {"$set": {"password_hash": hash_password(payload.new_password), "updated_at": datetime.utcnow()}},
    )
    return ok({"status": "成功"})
