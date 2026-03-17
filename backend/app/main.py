from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.api import api_router
from app.core.database import engine, Base
import app.models  # noqa: F401 — register all models with Base

settings = get_settings()


def _add_missing_columns(conn):
    from sqlalchemy import text
    # IF NOT EXISTS avoids transaction abort on duplicate column (PostgreSQL 9.6+)
    conn.execute(text("ALTER TABLE sources ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'other'"))
    conn.execute(text("ALTER TABLE sources ADD COLUMN IF NOT EXISTS show_in_feed BOOLEAN NOT NULL DEFAULT TRUE"))

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables if needed (for dev; use Alembic in prod)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_add_missing_columns)
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
