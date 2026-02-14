"""采购计划 Schema。"""

from decimal import Decimal
from pydantic import BaseModel

from app.schemas.common import AuditTimestamps


class ProcurementPlanItem(BaseModel):
    """采购计划明细项。"""
    product_id: str
    category_id: str | None = None
    category_name: str | None = None
    name: str
    unit: str | None = None
    price: Decimal
    quantity: Decimal
    amount: Decimal


class ProcurementPlan(BaseModel, AuditTimestamps):
    """采购计划输出结构。"""
    id: str | None = None
    date: str
    year_month: str
    total_amount: Decimal
    creator_id: str | None = None
    updated_by: str | None = None
    items: list[ProcurementPlanItem]
    warnings: list[dict] | None = None
