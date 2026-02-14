"""统一响应封装。

将业务数据包装为统一的 code/message/data 结构。
"""

from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse

from app.core import error_codes


def ok(data=None, message: str = "成功") -> JSONResponse:
    """返回成功响应。"""
    payload = {"code": error_codes.SUCCESS, "message": message, "data": data}
    return JSONResponse(status_code=200, content=jsonable_encoder(payload))


def error(code: int, message: str, status_code: int = 400) -> JSONResponse:
    """返回错误响应。"""
    payload = {"code": code, "message": message}
    return JSONResponse(status_code=status_code, content=payload)
