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

SPORTDB_API_KEY = os.environ.get("SPORTDB_API_KEY", "HQQYgzbVboleYaabgKnDeOWKC2pLUtNlN77tX6Ba")

@router.get("/football/fixtures")
async def get_football_fixtures(date: str | None = None):
    """
    Получает матчи из бесплатных iCal (.ics) календарей.
    Возвращает закешированный ответ в течение 10 минут.
    """
    now = datetime.utcnow()
    # If we have valid cache, return it
    if _football_cache["timestamp"] and _football_cache["data"]:
        diff = (now - _football_cache["timestamp"]).total_seconds()
        if diff < (10 * 60):
            return _football_cache["data"]

    urls = [
        {"name": "Английская Премьер-лига", "url": "https://ics.fixtur.es/v2/league/premier-league.ics"},
        {"name": "Российская Премьер-лига", "url": "https://ics.fixtur.es/v2/league/russian-premier-league.ics"}
    ]
    
    all_matches = []
    
    try:
        from datetime import timedelta
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
        async with httpx.AsyncClient() as client:
            for league in urls:
                try:
                    resp = await client.get(league["url"], timeout=8.0, follow_redirects=True, headers=headers)
                    if resp.status_code != 200:
                        continue
                    
                    lines = resp.text.splitlines()
                    event = {}
                    for line in lines:
                        line = line.strip()
                        if line == "BEGIN:VEVENT":
                            event = {}
                        elif line.startswith("SUMMARY:"):
                            event["summary"] = line[len("SUMMARY:"):]
                        elif line.startswith("DTSTART"):
                            val = line.split(":")[-1]
                            val = val.replace("Z", "")
                            event["start"] = val
                        elif line == "END:VEVENT":
                            if "summary" in event and "start" in event:
                                try:
                                    dt_obj = datetime.strptime(event["start"], "%Y%m%dT%H%M%S")
                                    # Adjust timezone roughly +3 for Moscow, UI expects localized or raw time?
                                    # We'll just pass the naive time string and let the frontend show it.
                                    # But let's add 3 hours to UTC for MSK display since the user is in MSK (+3)
                                    msk_dt = dt_obj + timedelta(hours=3)
                                    delta = dt_obj - now
                                    
                                    # Keep matches from yesterday up to next 14 days
                                    if timedelta(days=-2) <= delta <= timedelta(days=14):
                                        parts = event["summary"].split(" - ")
                                        home = parts[0].strip() if len(parts) > 0 else "Unknown"
                                        away = parts[1].strip() if len(parts) > 1 else "Unknown"
                                        
                                        stage = 1 if delta.total_seconds() > 0 else 3
                                        game_time = msk_dt.strftime("%d.%m %H:%M")
                                        
                                        all_matches.append({
                                            "eventId": f"{league['name']}_{dt_obj.strftime('%Y%m%d%H%M')}_{home}",
                                            "eventStageId": stage,
                                            "gameTime": game_time,
                                            "homeName": home,
                                            "awayName": away,
                                            "tournamentName": league["name"]
                                        })
                                except Exception as e:
                                    pass
                except Exception:
                    pass
                    
        # Sort by gameTime
        all_matches.sort(key=lambda x: x["eventId"])
        
        _football_cache["timestamp"] = now
        _football_cache["data"] = all_matches
        
        return all_matches
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse iCal data: {str(e)}")


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
