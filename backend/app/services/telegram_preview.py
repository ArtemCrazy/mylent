"""Превью канала Telegram: аватар по username. Требует существующую сессию (после telegram_sync)."""
import base64
import os
import asyncio
import logging
import urllib.request
import urllib.error
import re
from io import BytesIO
from typing import Any

from telethon import TelegramClient

from app.core.config import get_settings

logger = logging.getLogger(__name__)

# Блокировка для устранения "database is locked" в SQLite файле Telethon
_preview_lock = asyncio.Lock()

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
    Оборачивает _get_info_impl в таймаут, чтобы не зависать при блокировке БД Telethon.
    """
    try:
        return await asyncio.wait_for(_get_info_impl(username), timeout=30.0)
    except (asyncio.TimeoutError, Exception) as e:
        logger.error(f"Error getting Telegram preview for {username}: {repr(e)}")
        # Если не вышло (таймаут или ошибка), предполагаем, что добавлять можно (нет запрета)
        return {"has_public_link": True, "avatar_base64": None}

async def _get_info_impl(username: str) -> dict[str, Any]:
    """
    Фактическая реализация проверки канала (Telethon + HTTP HTML Fallback).
    """
    username = _normalize_username(username)
    result: dict[str, Any] = {"has_public_link": False, "avatar_base64": None}
    if not username:
        return result
    if _is_invite_link(username):
        return result
        
    # 1. HTTP Scrape fallback (Bypasses Telethon SQLite lock entirely for public channels)
    try:
        def fetch_html_avatar():
            url = f"https://t.me/{username}"
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
            with urllib.request.urlopen(req, timeout=5.0) as response:
                html = response.read().decode('utf-8', errors='ignore')
                match = re.search(r'<meta property="og:image" content="(https://[^"]+)"', html)
                if match:
                    img_url = match.group(1)
                    if "t_logo" not in img_url.lower():  # Игнорируем стандартное лого Telegram
                        img_req = urllib.request.Request(img_url, headers={'User-Agent': 'Mozilla/5.0'})
                        with urllib.request.urlopen(img_req, timeout=5.0) as img_resp:
                            return base64.b64encode(img_resp.read()).decode("ascii")
            return None

        avatar_b64 = await asyncio.to_thread(fetch_html_avatar)
        if avatar_b64:
            result["avatar_base64"] = avatar_b64
            result["has_public_link"] = True
            return result
    except Exception as e:
        logger.warning(f"Fast HTTP avatar fetch failed for {username}: {repr(e)}")

    # 2. Если не вышло (например приватный канал), пробуем Telethon
    settings = get_settings()
    api_id = (settings.telegram_api_id or "").strip()
    api_hash = (settings.telegram_api_hash or "").strip()
    # Если нет credentials или сессии — не можем проверить, считаем публичным
    if not api_id or not api_hash:
        result["has_public_link"] = True
        return result
    try:
        api_id_int = int(api_id)
    except ValueError:
        result["has_public_link"] = True
        return result
    session_path = settings.telegram_session_path or "./data/telegram_session"
    if not os.path.exists(session_path + ".session") and not os.path.exists(session_path):
        result["has_public_link"] = True
        return result
        
    async with _preview_lock:
        client = TelegramClient(session_path, api_id_int, api_hash)
        try:
            await client.connect()
            if not await client.is_user_authorized():
                # Нет авторизации — не можем проверить, считаем публичным
                result["has_public_link"] = True
                return result
            entity = await client.get_entity(username)
            if not entity_has_public_link(entity):
                return result  # has_public_link остаётся False — канал точно invite-only
            result["has_public_link"] = True
            buf = BytesIO()
            await client.download_profile_photo(entity, file=buf)
            buf.seek(0)
            data = buf.getvalue()
            if data:
                result["avatar_base64"] = base64.b64encode(data).decode("ascii")
            return result
        except Exception as e:
            logger.error(f"Telethon internal error for {username}: {repr(e)}")
            result["has_public_link"] = True
        finally:
            await client.disconnect()
            
    return result


async def get_channel_avatar_base64(username: str) -> str | None:
    """Возвращает base64 аватара канала/чата или None. Каналы без публичной ссылки дают None."""
    info = await get_channel_public_info(username)
    return info.get("avatar_base64")
