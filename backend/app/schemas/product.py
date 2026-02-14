"""产品相关 Schema。"""

from decimal import Decimal
from pydantic import BaseModel

from app.schemas.common import AuditTimestamps


class ItemQuantityRange(BaseModel):
    """单品采购数量范围。"""
    min: Decimal
    max: Decimal


class ProductBase(BaseModel):
    """产品基础字段定义。"""
    name: str
    category_id: str
    category_name: str
    unit: str
    base_price: Decimal
    volatility: Decimal | None = None
    item_quantity_range: ItemQuantityRange | None = None
    is_deleted: bool = False


class ProductCreate(BaseModel):
    """产品创建请求体。"""
    name: str
    category_id: str
    unit: str
    base_price: Decimal
    volatility: Decimal | None = None
    item_quantity_range: ItemQuantityRange | None = None


class ProductUpdate(BaseModel):
    """产品更新请求体。"""
    name: str | None = None
    category_id: str | None = None
    unit: str | None = None
    base_price: Decimal | None = None
    volatility: Decimal | None = None
    item_quantity_range: ItemQuantityRange | None = None
    is_deleted: bool | None = None


class Product(ProductBase, AuditTimestamps):
    """产品输出结构。"""
    id: str | None = None
