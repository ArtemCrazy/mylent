from contextlib import asynccontextmanager
import json
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select

from app.core.config import get_settings
from app.core.database import engine, Base, AsyncSessionLocal
from app.core.security import get_password_hash
from app.api import api_router
import app.models  # noqa: F401 — register all models with Base
from app.models.user import User
from app.models.source import Source

settings = get_settings()


def _add_missing_columns(conn):
    from sqlalchemy import text
    # IF NOT EXISTS avoids transaction abort on duplicate column (PostgreSQL 9.6+)
    conn.execute(text("ALTER TABLE sources ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'other'"))
    conn.execute(text("ALTER TABLE sources ADD COLUMN IF NOT EXISTS show_in_feed BOOLEAN NOT NULL DEFAULT TRUE"))
    # Fix PostgreSQL sequences (SQLite не поддерживает setval)
    if "postgresql" in get_settings().database_url:
        conn.execute(text("""
            SELECT setval(
                pg_get_serial_sequence('sources', 'id'),
                COALESCE((SELECT MAX(id) FROM sources), 0) + 1,
                false
            )
        """))
        conn.execute(text("""
            SELECT setval(
                pg_get_serial_sequence('posts', 'id'),
                COALESCE((SELECT MAX(id) FROM posts), 0) + 1,
                false
            )
        """))

async def _ensure_auto_setup():
    """При первом запуске: создать админа и источники из env (деплой без ручных шагов)."""
    s = get_settings()
    async with AsyncSessionLocal() as db:
        # Авто-создание первого пользователя
        if s.admin_login and len(s.admin_password or "") >= 8:
            r = await db.execute(select(User))
            if r.scalars().first() is None:
                user = User(
                    email=s.admin_login.strip(),
                    password_hash=get_password_hash(s.admin_password),
                )
                db.add(user)
        # Авто-создание Telegram-источников из TELEGRAM_CHANNELS (channel1,channel2)
        if s.telegram_channels:
            for raw in s.telegram_channels.split(","):
                slug = raw.strip().lstrip("@").lower()
                if not slug:
                    continue
                r = await db.execute(select(Source).where(Source.type == "telegram", Source.slug == slug))
                if r.scalars().first() is None:
                    src = Source(
                        type="telegram",
                        title=slug,
                        slug=slug,
                        config_json=json.dumps({"channel_username": slug}),
                        is_active=True,
                        show_in_feed=True,
                    )
                    db.add(src)
        await db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables if needed (for dev; use Alembic in prod)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_add_missing_columns)
    await _ensure_auto_setup()
    yield
    # Shutdown
    await engine.dispose()


app = FastAPI(
    title=settings.app_name,
    debug=settings.debug,
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(api_router)

# Serve downloaded Telegram media files
_media_dir = os.path.join(os.environ.get("TELEGRAM_SESSION_PATH", "./data").rsplit("/", 1)[0] if "/" in os.environ.get("TELEGRAM_SESSION_PATH", "./data") else "./data", "media")
os.makedirs(_media_dir, exist_ok=True)
app.mount("/media", StaticFiles(directory=_media_dir), name="media")


@app.get("/")
async def root():
    return {
        "app": settings.app_name,
        "message": "Это API. Откройте интерфейс: http://localhost:3000 (или 3001, 3002, 3003 — смотрите в терминале frontend).",
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health")
async def health():
    return {"status": "ok"}
