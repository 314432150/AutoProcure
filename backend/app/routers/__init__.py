"""路由模块导出入口。"""
from app.routers import auth, categories, history, procurement, procurement_export, products, workdays

__all__ = [
    "auth",
    "categories",
    "products",
    "workdays",
    "procurement",
    "history",
    "procurement_export",
]
