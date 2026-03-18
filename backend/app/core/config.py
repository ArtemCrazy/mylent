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

    # DeepSeek (for digest generation)
    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_model: str = "deepseek-chat"
    digest_schedule_hours: str = "8,14,20"  # hours (UTC) to auto-generate digests

    # Telegram (for ingestion worker)
    telegram_session_path: str = "./data/telegram_session"
    telegram_api_id: str = ""
    telegram_api_hash: str = ""

    # CORS: для продакшена задайте через запятую, например https://ваш-домен.ru,https://mylent.vercel.app
    cors_origins: str = ""

    # Авто-создание при первом запуске (деплой без ручных шагов)
    admin_login: str = ""  # Email первого пользователя; если задан и пользователей нет — создаётся
    admin_password: str = ""  # Пароль (минимум 8 символов)
    telegram_channels: str = ""  # Каналы через запятую: durov,techcrunch — создаются как источники типа telegram

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()
