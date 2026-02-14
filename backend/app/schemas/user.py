"""用户 Schema。"""

from pydantic import BaseModel

from app.schemas.common import AuditTimestamps


class UserBase(BaseModel):
    """用户基础字段。"""
    username: str
    full_name: str | None = None
    is_active: bool = True


class UserCreate(UserBase):
    """用户创建请求体。"""
    password: str


class User(UserBase, AuditTimestamps):
    """用户输出结构。"""
    id: str | None = None
    last_login: str | None = None
