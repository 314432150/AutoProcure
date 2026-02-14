"""品类相关 Schema。"""

from pydantic import BaseModel

from app.schemas.common import AuditTimestamps


class ItemsCountRange(BaseModel):
    """选品数量范围。"""
    min: int
    max: int


class CategoryBase(BaseModel):
    """品类基础字段定义。"""
    name: str
    is_active: bool = True
    purchase_mode: str | None = None
    cycle_days: int | None = None
    float_days: int | None = None
    items_count_range: ItemsCountRange | None = None


class CategoryCreate(BaseModel):
    """品类创建请求体。"""
    name: str
    purchase_mode: str | None = None
    cycle_days: int | None = None
    float_days: int | None = None
    items_count_range: ItemsCountRange | None = None


class CategoryUpdate(BaseModel):
    """品类更新请求体。"""
    name: str | None = None
    is_active: bool | None = None
    purchase_mode: str | None = None
    cycle_days: int | None = None
    float_days: int | None = None
    items_count_range: ItemsCountRange | None = None


class CategoryDeactivate(BaseModel):
    """品类停用请求体。"""
    transfer_to_id: str | None = None


class Category(CategoryBase, AuditTimestamps):
    """品类输出结构。"""
    id: str | None = None
