from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.api import api_router
from app.core.database import engine, Base

settings = get_settings()


def _add_category_column_if_missing(conn):
    from sqlalchemy import text
    try:
        conn.execute(text("ALTER TABLE sources ADD COLUMN category VARCHAR(50) DEFAULT 'other'"))
    except Exception:
        pass  # column already exists

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables if needed (for dev; use Alembic in prod)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_add_category_column_if_missing)
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
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://localhost:3003",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:3002",
        "http://127.0.0.1:3003",
    ],
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
