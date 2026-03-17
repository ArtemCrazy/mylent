from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    app_name: str = "MyLent"
    debug: bool = False

    # Database (по умолчанию SQLite для разработки без установки PostgreSQL)
    database_url: str = "sqlite+aiosqlite:///./mylent.db"
    database_url_sync: str = "sqlite:///./mylent.db"

    # Auth
    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days

    # OpenAI
    openai_api_key: str = ""

    # Telegram (for ingestion worker)
    telegram_session_path: str = "./data/telegram_session"
    telegram_api_id: str = ""
    telegram_api_hash: str = ""

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()
