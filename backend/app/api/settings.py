from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from app.api.deps import CurrentUser, DbSession
from app.models.user import User
import json

router = APIRouter(prefix="/settings", tags=["settings"])


class SettingsUpdate(BaseModel):
    theme: Optional[str] = None
    ai_summary_enabled: Optional[bool] = None
    digest_enabled: Optional[bool] = None
    sync_interval_minutes: Optional[int] = None


class SettingsResponse(BaseModel):
    theme: str = "dark"
    ai_summary_enabled: bool = True
    digest_enabled: bool = True
    sync_interval_minutes: int = 60


def _parse_settings(settings_json: Optional[str]) -> dict:
    if not settings_json:
        return {}
    try:
        return json.loads(settings_json)
    except Exception:
        return {}


@router.get("", response_model=SettingsResponse)
async def get_settings(current_user: CurrentUser):
    data = _parse_settings(current_user.settings_json)
    return SettingsResponse(
        theme=data.get("theme", "dark"),
        ai_summary_enabled=data.get("ai_summary_enabled", True),
        digest_enabled=data.get("digest_enabled", True),
        sync_interval_minutes=data.get("sync_interval_minutes", 60),
    )


@router.patch("", response_model=SettingsResponse)
async def update_settings(body: SettingsUpdate, db: DbSession, current_user: CurrentUser):
    data = _parse_settings(current_user.settings_json)
    for k, v in body.model_dump(exclude_unset=True).items():
        if v is not None:
            data[k] = v
    current_user.settings_json = json.dumps(data)
    await db.flush()
    await db.refresh(current_user)
    return SettingsResponse(
        theme=data.get("theme", "dark"),
        ai_summary_enabled=data.get("ai_summary_enabled", True),
        digest_enabled=data.get("digest_enabled", True),
        sync_interval_minutes=data.get("sync_interval_minutes", 60),
    )
