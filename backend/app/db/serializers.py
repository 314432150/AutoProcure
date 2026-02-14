"""序列化工具。

将 Decimal 等类型转换为 Mongo 可写入的基础类型。
"""

from decimal import Decimal
from typing import Any


def encode_for_mongo(value: Any) -> Any:
    """递归转换数据为 Mongo 可接受的类型。"""
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, dict):
        return {k: encode_for_mongo(v) for k, v in value.items()}
    if isinstance(value, list):
        return [encode_for_mongo(item) for item in value]
    return value
