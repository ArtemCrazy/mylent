"""Web-based Telegram authorization (avoids SSH for first-time session setup)."""
import os
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from telethon import TelegramClient
from telethon.errors import PhoneCodeInvalidError, SessionPasswordNeededError

from app.api.deps import CurrentUser
from app.core.config import get_settings

router = APIRouter(prefix="/telegram", tags=["telegram"])

# In-memory state for the ongoing auth flow (single-user app, short-lived)
_state: dict = {}
_client: Optional[TelegramClient] = None


def _make_client() -> TelegramClient:
    settings = get_settings()
    session_path = settings.telegram_session_path or "./data/telegram_session"
    os.makedirs(os.path.dirname(session_path) or ".", exist_ok=True)
    return TelegramClient(session_path, int((settings.telegram_api_id or "").strip()), (settings.telegram_api_hash or "").strip())


@router.get("/status")
async def telegram_status(_: CurrentUser):
    settings = get_settings()
    has_creds = bool((settings.telegram_api_id or "").strip() and (settings.telegram_api_hash or "").strip())
    if not has_creds:
        return {"authorized": False, "has_credentials": False}
    try:
        client = _make_client()
        await client.connect()
        authorized = await client.is_user_authorized()
        await client.disconnect()
        return {"authorized": authorized, "has_credentials": True}
    except Exception as e:
        return {"authorized": False, "has_credentials": True, "error": str(e)}


class PhoneIn(BaseModel):
    phone: str


class CodeIn(BaseModel):
    phone: str
    code: str
    password: Optional[str] = None  # 2FA cloud password if needed


@router.post("/auth/phone")
async def auth_phone(body: PhoneIn, _: CurrentUser):
    global _client
    settings = get_settings()
    if not (settings.telegram_api_id or "").strip():
        raise HTTPException(400, "TELEGRAM_API_ID не задан на сервере")
    try:
        _client = _make_client()
        await _client.connect()
        result = await _client.send_code_request(body.phone.strip())
        _state["phone"] = body.phone.strip()
        _state["phone_code_hash"] = result.phone_code_hash
        return {"ok": True, "message": "Код отправлен в Telegram"}
    except HTTPException:
        raise
    except Exception as e:
        if _client:
            try:
                await _client.disconnect()
            except Exception:
                pass
            _client = None
        raise HTTPException(500, f"Ошибка подключения к Telegram: {e}")


@router.post("/auth/code")
async def auth_code(body: CodeIn, _: CurrentUser):
    global _client
    if not _client or "phone_code_hash" not in _state:
        raise HTTPException(400, "Сначала запросите код по номеру телефона")
    try:
        await _client.sign_in(
            body.phone,
            body.code,
            phone_code_hash=_state["phone_code_hash"],
        )
    except SessionPasswordNeededError:
        if not body.password:
            raise HTTPException(400, "2FA: введите пароль облачного хранилища Telegram")
        await _client.sign_in(password=body.password)
    except PhoneCodeInvalidError:
        raise HTTPException(400, "Неверный код")
    except Exception as e:
        raise HTTPException(400, str(e))
    _state.clear()
    await _client.disconnect()
    _client = None
    return {"ok": True, "message": "Telegram успешно подключён. Синхронизация запустится в течение минуты."}
