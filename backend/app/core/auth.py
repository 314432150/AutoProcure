"""权限占位实现。

用于放行所有请求（开发阶段使用）。
"""

from fastapi import Request


async def allow_all(_: Request) -> None:
    """允许所有请求通过，不做权限校验。"""
    return None
