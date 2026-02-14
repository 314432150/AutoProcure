"""系统设置 Schema。"""

from decimal import Decimal
from pydantic import BaseModel, ConfigDict

from app.schemas.common import AuditTimestamps


class BudgetRange(BaseModel):
    """预算区间。"""
    min: Decimal
    max: Decimal


class Settings(BaseModel, AuditTimestamps):
    """系统设置输出结构。"""
    daily_budget_range: BudgetRange | None = None


class SettingsUpdate(BaseModel):
    """系统设置更新结构。"""
    model_config = ConfigDict(extra="forbid")
    daily_budget_range: BudgetRange | None = None
