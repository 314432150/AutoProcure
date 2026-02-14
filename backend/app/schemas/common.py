"""通用 Schema 定义。"""

from datetime import datetime


class AuditTimestamps:
    """通用审计字段混入。"""
    created_at: datetime | None = None
    updated_at: datetime | None = None
