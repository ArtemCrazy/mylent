from fastapi import APIRouter
from app.api.auth import router as auth_router
from app.api.sources import router as sources_router
from app.api.posts import router as posts_router
from app.api.search import router as search_router
from app.api.digests import router as digests_router
from app.api.settings import router as settings_router
from app.api.telegram_auth import router as telegram_router
from app.api.sync import router as sync_router

api_router = APIRouter(prefix="/api")
api_router.include_router(auth_router)
api_router.include_router(sources_router)
api_router.include_router(posts_router)
api_router.include_router(search_router)
api_router.include_router(digests_router)
api_router.include_router(settings_router)
api_router.include_router(telegram_router)
api_router.include_router(sync_router)
