"""中间件模块。

提供权限校验中间件，拦截请求并进行令牌检查。
"""

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.permissions import PermissionChecker


class PermissionMiddleware(BaseHTTPMiddleware):
    """基于 PermissionChecker 的权限校验中间件。"""

    def __init__(self, app, allow_all: bool = True) -> None:
        """初始化中间件与权限校验器。"""
        super().__init__(app)
        self._checker = PermissionChecker(allow_all=allow_all)

    async def dispatch(self, request: Request, call_next):
        """处理请求前执行权限校验。"""
        await self._checker(request)
        return await call_next(request)
