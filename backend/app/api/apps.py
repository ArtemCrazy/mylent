import os
import json
import httpx
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
from app.api.deps import CurrentUser, DbSession
from sqlalchemy import select
from app.models.user import User

router = APIRouter(prefix="/apps", tags=["apps"])

# Simple in-memory cache to prevent burning API-Football limits
_CACHE_TIMEOUT_SECONDS = 5 * 60  # 5 minutes
_football_cache: dict = {
    "timestamp": None,
    "data": None
}

SPORTDB_API_KEY = os.environ.get("SPORTDB_API_KEY")

@router.get("/football/fixtures")
async def get_football_fixtures(date: str | None = None):
    """
    Получает матчи.
    Возвращает закешированный ответ в течение 3 минут.
    """
    if not SPORTDB_API_KEY:
        raise HTTPException(
            status_code=503, 
            detail="SPORTDB_API_KEY is not configured in .env"
        )

    now = datetime.utcnow()
    # If we have valid cache, return it
    if _football_cache["timestamp"] and _football_cache["data"]:
        diff = (now - _football_cache["timestamp"]).total_seconds()
        if diff < (3 * 60):
            return _football_cache["data"]

    headers = {
        "X-API-Key": SPORTDB_API_KEY
    }
    
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://api.sportdb.dev/api/flashscore/football/live",
                params={"tz": 3, "offset": 0},
                headers=headers,
                timeout=12.0
            )
            resp.raise_for_status()
            payload = resp.json()
            
            if "errors" in payload:
                raise Exception(str(payload["errors"]))
                
            _football_cache["timestamp"] = now
            _football_cache["data"] = payload
            
            return payload
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch sportdb data: {str(e)}")


@router.get("/settings")
async def get_app_settings(current_user: CurrentUser):
    try:
        return json.loads(current_user.settings_json or "{}")
    except Exception:
        return {}


@router.patch("/settings")
async def update_app_settings(updates: dict, current_user: CurrentUser, db: DbSession):
    """
    Обновляет настройки пользователя (например включенные лиги футбола)
    """
    try:
        user_settings = json.loads(current_user.settings_json or "{}")
        user_settings.update(updates)
        current_user.settings_json = json.dumps(user_settings)
        await db.commit()
        return {"status": "ok", "settings": user_settings}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
