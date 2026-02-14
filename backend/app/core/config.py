"""应用配置。

从环境变量与 .env 文件加载项目配置。
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class AppConfig(BaseSettings):
    """项目配置模型。"""
    model_config = SettingsConfigDict(env_file=(".env", "backend/.env"))

    app_name: str = "AutoProcure"
    mongo_uri: str = "mongodb://localhost:27017"
    mongo_db: str = "autoprocure"
    mongo_server_selection_timeout_ms: int = 3000
    jwt_secret: str = "change_me_to_a_long_secret_key_at_least_32_chars"
    jwt_algorithm: str = "HS256"
    jwt_expires_minutes: int = 60 * 24 * 7
    auth_enabled: bool = True
    workday_api_url: str | None = None
    workday_api_key: str | None = None
    workday_api_timeout: int = 10
    workday_fallback: bool = True
    workday_provider: str = "pandas_market_calendars"
    workday_calendar: str = "SSE"

config = AppConfig()
