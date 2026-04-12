import json
from datetime import datetime, timedelta

import httpx
from fastapi import APIRouter, HTTPException, Query

from app.api.deps import CurrentUser, DbSession

router = APIRouter(prefix="/apps", tags=["apps"])

_FOOTBALL_CACHE_TTL_SECONDS = 10 * 60
_WEATHER_CACHE_TTL_SECONDS = 10 * 60
_MAGNETIC_CACHE_TTL_SECONDS = 10 * 60

_football_cache: dict[str, object] = {
    "timestamp": None,
    "data": None,
}
_weather_cache: dict[str, dict[str, object]] = {}
_magnetic_cache: dict[str, object] = {
    "timestamp": None,
    "data": None,
}


def _is_cache_fresh(timestamp: object, ttl_seconds: int) -> bool:
    if not isinstance(timestamp, datetime):
        return False
    return (datetime.utcnow() - timestamp).total_seconds() < ttl_seconds


def _recursive_merge(base: dict, updates: dict) -> dict:
    merged = dict(base)
    for key, value in updates.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = _recursive_merge(merged[key], value)
        else:
            merged[key] = value
    return merged


def _zip_series(block: dict, fields: list[str]) -> list[dict]:
    times = block.get("time") or []
    rows: list[dict] = []

    for index, timestamp in enumerate(times):
        row = {"time": timestamp}
        for field in fields:
            values = block.get(field) or []
            row[field] = values[index] if index < len(values) else None
        rows.append(row)

    return rows


def _format_location_label(location: dict) -> str:
    parts: list[str] = []
    for key in ("name", "admin1", "country"):
        value = location.get(key)
        if isinstance(value, str) and value and value not in parts:
            parts.append(value)
    return ", ".join(parts)


def _describe_magnetic_activity(kp_value: float | None) -> dict | None:
    if kp_value is None:
        return None

    if kp_value < 4:
        level = "Спокойная"
        scale = None
    elif kp_value < 5:
        level = "Повышенная"
        scale = None
    elif kp_value < 6:
        level = "Слабая буря"
        scale = "G1"
    elif kp_value < 7:
        level = "Умеренная буря"
        scale = "G2"
    elif kp_value < 8:
        level = "Сильная буря"
        scale = "G3"
    elif kp_value < 9:
        level = "Очень сильная буря"
        scale = "G4"
    else:
        level = "Экстремальная буря"
        scale = "G5"

    return {
        "kp_index": round(kp_value, 1),
        "level": level,
        "scale": scale,
    }


async def _get_magnetic_activity() -> dict | None:
    now = datetime.utcnow()
    if _magnetic_cache["data"] and _is_cache_fresh(_magnetic_cache["timestamp"], _MAGNETIC_CACHE_TTL_SECONDS):
        return _magnetic_cache["data"]  # type: ignore[return-value]

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://services.swpc.noaa.gov/json/planetary_k_index_1m.json",
                timeout=10.0,
            )
            response.raise_for_status()
    except httpx.HTTPError:
        return None

    payload = response.json()
    if not isinstance(payload, list) or not payload:
        return None

    latest = payload[-1]
    if not isinstance(latest, dict):
        return None

    raw_kp = latest.get("estimated_kp")
    if raw_kp is None:
        raw_kp = latest.get("kp_index")

    try:
        kp_value = float(raw_kp) if raw_kp is not None else None
    except (TypeError, ValueError):
        kp_value = None

    magnetic = _describe_magnetic_activity(kp_value)
    if magnetic is None:
        return None

    magnetic["updated_at"] = latest.get("time_tag")
    _magnetic_cache["timestamp"] = now
    _magnetic_cache["data"] = magnetic
    return magnetic


@router.get("/football/fixtures")
async def get_football_fixtures(date: str | None = None):
    """
    Получает матчи из бесплатных iCal (.ics) календарей.
    Возвращает закешированный ответ в течение 10 минут.
    """
    now = datetime.utcnow()
    if _football_cache["data"] and _is_cache_fresh(_football_cache["timestamp"], _FOOTBALL_CACHE_TTL_SECONDS):
        return _football_cache["data"]

    urls = [
        {"name": "Английская Премьер-лига", "url": "https://ics.fixtur.es/v2/league/premier-league.ics"},
        {"name": "Российская Премьер-лига", "url": "https://ics.fixtur.es/v2/league/russian-premier-league.ics"},
    ]

    all_matches = []

    try:
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
        async with httpx.AsyncClient() as client:
            for league in urls:
                try:
                    response = await client.get(league["url"], timeout=8.0, follow_redirects=True, headers=headers)
                    if response.status_code != 200:
                        continue

                    lines = response.text.splitlines()
                    event: dict[str, str] = {}
                    for line in lines:
                        line = line.strip()
                        if line == "BEGIN:VEVENT":
                            event = {}
                        elif line.startswith("SUMMARY:"):
                            event["summary"] = line[len("SUMMARY:"):]
                        elif line.startswith("DTSTART"):
                            event["start"] = line.split(":")[-1].replace("Z", "")
                        elif line == "END:VEVENT" and "summary" in event and "start" in event:
                            try:
                                dt_obj = datetime.strptime(event["start"], "%Y%m%dT%H%M%S")
                                msk_dt = dt_obj + timedelta(hours=3)
                                delta = dt_obj - now

                                if timedelta(days=-2) <= delta <= timedelta(days=14):
                                    parts = event["summary"].split(" - ")
                                    home = parts[0].strip() if len(parts) > 0 else "Unknown"
                                    away = parts[1].strip() if len(parts) > 1 else "Unknown"

                                    all_matches.append(
                                        {
                                            "eventId": f"{league['name']}_{dt_obj.strftime('%Y%m%d%H%M')}_{home}",
                                            "eventStageId": 1 if delta.total_seconds() > 0 else 3,
                                            "gameTime": msk_dt.strftime("%d.%m %H:%M"),
                                            "homeName": home,
                                            "awayName": away,
                                            "tournamentName": league["name"],
                                        }
                                    )
                            except Exception:
                                continue
                except Exception:
                    continue

        all_matches.sort(key=lambda item: item["eventId"])
        _football_cache["timestamp"] = now
        _football_cache["data"] = all_matches
        return all_matches
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to parse iCal data: {exc}") from exc


@router.get("/weather/search")
async def search_weather_locations(q: str = Query(..., min_length=2, max_length=80)):
    query = q.strip()
    if len(query) < 2:
        return []

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://geocoding-api.open-meteo.com/v1/search",
                params={
                    "name": query,
                    "count": 8,
                    "language": "ru",
                    "format": "json",
                },
                timeout=10.0,
            )
            response.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Не удалось найти город для прогноза погоды.") from exc

    payload = response.json()
    results = payload.get("results") or []
    normalized = []

    for item in results:
        normalized.append(
            {
                "name": item.get("name"),
                "country": item.get("country"),
                "admin1": item.get("admin1"),
                "latitude": item.get("latitude"),
                "longitude": item.get("longitude"),
                "timezone": item.get("timezone"),
                "label": _format_location_label(item),
            }
        )

    return normalized


@router.get("/weather/forecast")
async def get_weather_forecast(
    latitude: float,
    longitude: float,
    timezone_name: str | None = Query(default=None, alias="timezone"),
    label: str | None = None,
):
    timezone_value = timezone_name or "auto"
    cache_key = f"{latitude:.3f}:{longitude:.3f}:{timezone_value}"
    cache_entry = _weather_cache.get(cache_key)
    now = datetime.utcnow()
    magnetic_activity = await _get_magnetic_activity()

    if cache_entry and _is_cache_fresh(cache_entry.get("timestamp"), _WEATHER_CACHE_TTL_SECONDS):
        payload = cache_entry["data"]
    else:
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    "https://api.open-meteo.com/v1/forecast",
                    params={
                        "latitude": latitude,
                        "longitude": longitude,
                        "timezone": timezone_value,
                        "current": "temperature_2m,apparent_temperature,weather_code,is_day,wind_speed_10m,pressure_msl,precipitation,rain,showers",
                        "hourly": "temperature_2m,precipitation_probability,precipitation,rain,showers,weather_code,is_day,pressure_msl",
                        "forecast_hours": 24,
                        "minutely_15": "temperature_2m,precipitation,rain,showers,weather_code,is_day",
                        "forecast_minutely_15": 32,
                        "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum",
                        "forecast_days": 5,
                        "wind_speed_unit": "kmh",
                        "timeformat": "unixtime",
                    },
                    timeout=12.0,
                )
                response.raise_for_status()
                payload = response.json()
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=502, detail="Не удалось получить прогноз погоды.") from exc

        _weather_cache[cache_key] = {
            "timestamp": now,
            "data": payload,
        }

    forecast = {
        "location": {
            "label": label,
            "latitude": payload.get("latitude"),
            "longitude": payload.get("longitude"),
            "timezone": payload.get("timezone"),
            "timezone_abbreviation": payload.get("timezone_abbreviation"),
        },
        "current": {
            "time": payload.get("current", {}).get("time"),
            "temperature_2m": payload.get("current", {}).get("temperature_2m"),
            "apparent_temperature": payload.get("current", {}).get("apparent_temperature"),
            "weather_code": payload.get("current", {}).get("weather_code"),
            "is_day": payload.get("current", {}).get("is_day"),
            "wind_speed_10m": payload.get("current", {}).get("wind_speed_10m"),
            "pressure_msl": payload.get("current", {}).get("pressure_msl"),
            "precipitation": payload.get("current", {}).get("precipitation"),
            "rain": payload.get("current", {}).get("rain"),
            "showers": payload.get("current", {}).get("showers"),
        },
        "hourly": _zip_series(
            payload.get("hourly") or {},
            [
                "temperature_2m",
                "precipitation_probability",
                "precipitation",
                "rain",
                "showers",
                "weather_code",
                "is_day",
                "pressure_msl",
            ],
        ),
        "minutely": _zip_series(
            payload.get("minutely_15") or {},
            [
                "temperature_2m",
                "precipitation",
                "rain",
                "showers",
                "weather_code",
                "is_day",
            ],
        ),
        "daily": _zip_series(
            payload.get("daily") or {},
            [
                "weather_code",
                "temperature_2m_max",
                "temperature_2m_min",
                "precipitation_probability_max",
                "precipitation_sum",
            ],
        ),
        "magnetic_activity": magnetic_activity,
        "updated_at": int(now.timestamp()),
    }

    return forecast


@router.get("/settings")
async def get_app_settings(current_user: CurrentUser):
    try:
        return json.loads(current_user.settings_json or "{}")
    except Exception:
        return {}


@router.patch("/settings")
async def update_app_settings(updates: dict, current_user: CurrentUser, db: DbSession):
    """
    Обновляет настройки пользователя для раздела приложений.
    """
    try:
        user_settings = json.loads(current_user.settings_json or "{}")
        merged_settings = _recursive_merge(user_settings, updates)
        current_user.settings_json = json.dumps(merged_settings)
        await db.commit()
        return {"status": "ok", "settings": merged_settings}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
