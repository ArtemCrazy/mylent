"""Превью канала Telegram: аватар по username. Требует существующую сессию (после telegram_sync)."""
import base64
import os
from io import BytesIO
from typing import Any

from telethon import TelegramClient

from app.core.config import get_settings


def _normalize_username(raw: str) -> str:
    s = (raw or "").strip().lstrip("@").replace("https://t.me/", "").split("/")[0].split("?")[0]
    return s.strip()


def _is_invite_link(username: str) -> bool:
    """Ссылки-приглашения (joinchat/..., c/...) — нет публичной ссылки, парсить нельзя."""
    u = (username or "").strip().lower()
    return u.startswith("joinchat/") or u.startswith("c/")


def entity_has_public_link(entity: Any) -> bool:
    """У канала/чата есть публичный username (свободная ссылка), по которой можно парсить."""
    if entity is None:
        return False
    username = getattr(entity, "username", None)
    if username and (username or "").strip():
        return True
    # У Channel может быть usernames (список) вместо username
    usernames = getattr(entity, "usernames", None)
    if usernames:
        for u in usernames:
            if getattr(u, "username", None):
                return True
    return False


async def get_channel_public_info(username: str) -> dict[str, Any]:
    """
    Проверяет канал и возвращает has_public_link и avatar_base64.
    Каналы/чаты без публичной ссылки (только инвайт) — парсить нельзя, has_public_link=False.
    """
    username = _normalize_username(username)
    result: dict[str, Any] = {"has_public_link": False, "avatar_base64": None}
    if not username:
        return result
    if _is_invite_link(username):
        return result
    settings = get_settings()
    api_id = (settings.telegram_api_id or "").strip()
    api_hash = (settings.telegram_api_hash or "").strip()
    if not api_id or not api_hash:
        return result
    try:
        api_id_int = int(api_id)
    except ValueError:
        return result
    session_path = settings.telegram_session_path or "./data/telegram_session"
    if not os.path.exists(session_path + ".session") and not os.path.exists(session_path):
        return result
    client = TelegramClient(session_path, api_id_int, api_hash)
    try:
        await client.connect()
        if not await client.is_user_authorized():
            return result
        entity = await client.get_entity(username)
        if not entity_has_public_link(entity):
            return result
        result["has_public_link"] = True
        buf = BytesIO()
        await client.download_profile_photo(entity, file=buf)
        buf.seek(0)
        data = buf.getvalue()
        if data:
            result["avatar_base64"] = base64.b64encode(data).decode("ascii")
        return result
    except Exception:
        return result
    finally:
        await client.disconnect()


async def get_channel_avatar_base64(username: str) -> str | None:
    """Возвращает base64 аватара канала/чата или None. Каналы без публичной ссылки дают None."""
    info = await get_channel_public_info(username)
    return info.get("avatar_base64")
