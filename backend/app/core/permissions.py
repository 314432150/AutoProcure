"""权限校验工具。

根据路径匹配权限，并校验请求中的认证令牌。
"""

from fastapi import HTTPException, Request

from app.core.security import get_user_from_token


PERMISSION_MAP = {
    "/api/products": "PRODUCTS",
    "/api/categories": "RULES",
    "/api/workdays": "WORKDAYS",
    "/api/procurement/exports": "EXPORT",
    "/api/procurement": "PLANS",
}


class PermissionChecker:
    """请求权限校验器（基于路径前缀）。"""

    def __init__(self, allow_all: bool = True, permission_map: dict | None = None) -> None:
        """初始化权限校验器。"""
        self.allow_all = allow_all
        self.permission_map = permission_map or PERMISSION_MAP

    async def __call__(self, request: Request) -> None:
        """处理请求权限校验，必要时验证令牌。"""
        if self.allow_all:
            return None

        if request.url.path in {"/health", "/openapi.json"} or request.url.path.startswith("/docs"):
            return None
        if request.url.path.startswith("/api/auth"):
            return None

        permission = self._match_permission(request.url.path)
        if permission is None:
            return None

        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="缺少令牌")

        token = auth_header.split(" ", 1)[1]
        await get_user_from_token(token)

        # 当前阶段默认只校验令牌有效性
        return None

    def _match_permission(self, path: str) -> str | None:
        """匹配路径对应的权限名称。"""
        for prefix, permission in self.permission_map.items():
            if path.startswith(prefix):
                return permission
        return None
