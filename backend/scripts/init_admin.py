"""初始化管理员账号。

用于容器启动时自动创建管理员账号。
若账号已存在则跳过，不覆盖已有密码。
"""

import asyncio
import os
from datetime import datetime
from zoneinfo import ZoneInfo

from app.core.security import hash_password
from app.db.mongo import get_client, get_database


async def init_admin() -> None:
    """幂等初始化管理员账号。"""
    username = os.getenv("INIT_ADMIN_USERNAME", "admin").strip() or "admin"
    password = os.getenv("INIT_ADMIN_PASSWORD", "admin123")
    full_name = os.getenv("INIT_ADMIN_FULL_NAME", "管理员").strip() or "管理员"

    db = get_database()
    await db.command("ping")

    existed = await db["users"].find_one({"username": username})
    if existed:
        print(f"管理员账号已存在，跳过初始化：{username}")
        return

    now = datetime.now(ZoneInfo("Asia/Shanghai")).replace(tzinfo=None)
    await db["users"].insert_one(
        {
            "username": username,
            "full_name": full_name,
            "password_hash": hash_password(password),
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        }
    )
    print(f"管理员账号创建完成：{username}")


async def main() -> None:
    """脚本入口。"""
    try:
        await init_admin()
    finally:
        get_client().close()


if __name__ == "__main__":
    asyncio.run(main())
