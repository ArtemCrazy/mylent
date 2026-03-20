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

API_FOOTBALL_HOST = "v3.football.api-sports.io"
API_FOOTBALL_KEY = os.environ.get("API_FOOTBALL_KEY")

@router.get("/football/fixtures")
async def get_football_fixtures(date: str | None = None):
    """
    Получает матчи на указанную дату (YYYY-MM-DD). 
    По умолчанию на сегодня.
    Возвращает закешированный ответ в течение 5 минут.
    """
    if not API_FOOTBALL_KEY:
        raise HTTPException(
            status_code=503, 
            detail="API_FOOTBALL_KEY is not configured in .env"
        )

    now = datetime.utcnow()
    # If we have valid cache, return it
    if _football_cache["timestamp"] and _football_cache["data"]:
        diff = (now - _football_cache["timestamp"]).total_seconds()
        if dict(Date=date) == _football_cache.get("args") and diff < _CACHE_TIMEOUT_SECONDS:
            return _football_cache["data"]

    target_date = date or now.strftime("%Y-%m-%d")
    
    # Английская премьер лига (39) и РПЛ (235)
    # Позволяем запрашивать несколько лиг одновременно (league=39-235 не работает, 
    # в v3 api нужно либо скачивать все fixtures и фильтровать, либо для конкретной лиги.
    # Но проще запросить timezone и date для нужных линдш.
    # Actually, v3 permits filtering by a single league. If we want multiple, we can fetch all for the date, 
    # or make multiple requests. Fetching all matches for a date takes 1 API call, but parsing is heavy.
    # Let's do 2 requests: one for 39 and one for 235, or just fetch all for date and filter on backend.
    
    # We will do 2 requests (since there are 2 leagues) to save parsing heavy "all matches" response
    # But wait! A single request for "date={date}" fetches EVERYTHING nicely and uses 1 credit.
    
    headers = {
        "x-apisports-key": API_FOOTBALL_KEY,
        "x-apisports-host": API_FOOTBALL_HOST
    }
    
    # Instead of requesting everything (~800 leagues), let's request them specifically to keep it fast
    # Wait, API-Football allows `fixtures?date=YYYY-MM-DD` which uses 1 call
    # Let's use that and filter by our allowed leagues (39, 235, and maybe Champions League (2))
    allowed_leagues = {39, 235, 2, 3}  # 2=UCL, 3=Europa
    
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"https://{API_FOOTBALL_HOST}/fixtures",
                params={"date": target_date, "timezone": "Europe/Moscow"},
                headers=headers,
                timeout=10.0
            )
            resp.raise_for_status()
            payload = resp.json()
            
            if payload.get("errors"):
                raise Exception(str(payload["errors"]))
                
            all_fixtures = payload.get("response", [])
            # Фильтруем только нужные лиги
            filtered = [f for f in all_fixtures if f["league"]["id"] in allowed_leagues]
            
            _football_cache["timestamp"] = now
            _football_cache["args"] = {"Date": date}
            _football_cache["data"] = filtered
            
            return filtered
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch football data: {str(e)}")


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
