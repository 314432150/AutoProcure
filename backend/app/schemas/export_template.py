"""导出模板 Schema。"""

from pydantic import BaseModel

from app.schemas.common import AuditTimestamps


class ExportColumn(BaseModel):
    """模板列定义。"""
    label: str
    field: str


class ExportTemplateBase(BaseModel):
    """模板基础字段。"""
    name: str
    title: str
    columns: list[ExportColumn]
    is_default: bool = False


class ExportTemplateCreate(ExportTemplateBase):
    """模板创建请求体。"""
    pass


class ExportTemplateUpdate(BaseModel):
    """模板更新请求体。"""
    name: str | None = None
    title: str | None = None
    columns: list[ExportColumn] | None = None
    is_default: bool | None = None


class ExportTemplate(ExportTemplateBase, AuditTimestamps):
    """模板输出结构。"""
    id: str | None = None
