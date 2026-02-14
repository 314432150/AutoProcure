"""应用入口。

创建 FastAPI 应用并注册路由与异常处理器。
"""

from fastapi import FastAPI
from typing import Any
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi import HTTPException

from app.core import error_codes
from app.core.middleware import PermissionMiddleware
from app.core.config import config
from app.core.response import ok
from app.routers import auth, categories, history, procurement, procurement_export, products, workdays


app = FastAPI(title="自动采购 API", version="0.1.0")

app.add_middleware(PermissionMiddleware, allow_all=not config.auth_enabled)

app.include_router(auth.router)
app.include_router(products.router)
app.include_router(workdays.router)
app.include_router(procurement.router)
app.include_router(history.router)
app.include_router(procurement_export.router)
app.include_router(categories.router)


@app.exception_handler(HTTPException)
async def http_exception_handler(_, exc: HTTPException) -> JSONResponse:
    """统一处理 HTTPException 并映射业务错误码。"""
    status_code = exc.status_code
    detail_obj = exc.detail if isinstance(exc.detail, dict) else None
    detail = detail_obj.get("message") if detail_obj else str(exc.detail)
    mapping = {
        400: error_codes.PARAM_ERROR,
        401: error_codes.AUTH_ERROR,
        403: error_codes.AUTH_ERROR,
        404: error_codes.NOT_FOUND,
        409: error_codes.CONFLICT,
        500: error_codes.SYSTEM_ERROR,
        502: error_codes.WORKDAY_API_ERROR,
    }
    business_mapping = {
        "存在未配置规则的品类": error_codes.RULE_MISSING,
        "未配置预算区间": error_codes.BUDGET_RANGE_INVALID,
        "预算区间无效": error_codes.BUDGET_RANGE_INVALID,
        "产品库为空": error_codes.PRODUCTS_EMPTY,
    }
    code = business_mapping.get(detail, mapping.get(status_code, error_codes.SYSTEM_ERROR))
    payload: dict[str, Any] = {"code": code, "message": detail}
    if detail_obj:
        payload["detail"] = detail_obj
    return JSONResponse(status_code=status_code, content=payload)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_, exc: RequestValidationError) -> JSONResponse:
    """处理请求参数校验错误。"""
    return JSONResponse(
        status_code=400,
        content={"code": error_codes.PARAM_ERROR, "message": "请求参数无效", "details": exc.errors()},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(_, exc: Exception) -> JSONResponse:
    """兜底处理未捕获异常。"""
    return JSONResponse(
        status_code=500,
        content={"code": error_codes.SYSTEM_ERROR, "message": "服务器内部错误"},
    )


@app.get("/health")
async def health_check() -> JSONResponse:
    """健康检查接口。"""
    return ok({"status": "正常"})
