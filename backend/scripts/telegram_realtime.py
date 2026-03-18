"""
Реал-тайм импорт: новые посты из каналов попадают в ленту сразу после публикации.
Запуск из папки backend (оставить работать в отдельном терминале):
  .\.venv\Scripts\python.exe -m scripts.telegram_realtime

Использует ту же сессию, что и telegram_sync (уже войдя один раз через telegram_sync).
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from telethon import TelegramClient, events
from telethon.tl.types import Message

from app.core.config import get_settings
from app.core.database import AsyncSessionLocal
from app.models.post import Post
from app.models.source import Source
from app.services.telegram_preview import entity_has_public_link


def get_channel_username(source: Source) -> str | None:
    if source.config_json:
        try:
            cfg = json.loads(source.config_json)
            if isinstance(cfg.get("channel_username"), str):
                return cfg["channel_username"].strip().lstrip("@")
        except Exception:
            pass
    if source.url:
        url = source.url.strip()
        if "t.me/" in url:
            return url.split("t.me/")[-1].split("/")[0].split("?")[0].strip().lstrip("@")
    return None


def make_preview(text: str, max_len: int = 300) -> str:
    if not text or len(text) <= max_len:
        return text or ""
    return text[:max_len].rsplit(" ", 1)[0] + "…" if " " in text[:max_len] else text[:max_len] + "…"


# channel_id (Telethon) -> source
_channel_to_source: dict[int, Source] = {}
_RELOAD_INTERVAL_SEC = 90  # перезагрузка списка каналов, чтобы подхватить только что добавленные


async def load_sources(client: TelegramClient) -> None:
    """Загружает список каналов и строит маппинг entity_id -> source."""
    global _channel_to_source
    _channel_to_source.clear()
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Source).where(Source.type == "telegram", Source.is_active == True)
        )
        sources = list(result.scalars().all())
    for source in sources:
        username = get_channel_username(source)
        if not username:
            continue
        try:
            entity = await client.get_entity(username)
            if not entity_has_public_link(entity):
                print(f"  Пропуск {source.title}: нет публичной ссылки")
                continue
            _channel_to_source[entity.id] = source
            print(f"  Слушаю: {source.title} (@{username})")
        except Exception as e:
            print(f"  Пропуск {source.title}: {e}")


async def on_new_message(event: events.NewMessage.Event) -> None:
    """Новое сообщение в одном из наших каналов — пишем в БД."""
    if not isinstance(event.message, Message):
        return
    text = (event.message.message or event.message.text or "").strip()
    if not text:
        return
    source = _channel_to_source.get(event.chat_id)
    if not source:
        return
    eid = str(event.message.id)
    username = get_channel_username(source)
    if not username:
        return
    now = datetime.now(timezone.utc)
    published_at = event.message.date
    if published_at and published_at.tzinfo is None:
        published_at = published_at.replace(tzinfo=timezone.utc)

    media_json = None
    if getattr(event.message, "media", None):
        has_photo = event.message.photo is not None
        has_video = getattr(event.message, "video", None) is not None or (
            getattr(event.message, "document", None) and getattr(event.message.document, "mime_type", None) or ""
        ).startswith("video/")
        if has_photo or has_video:
            media_json = json.dumps({
                "photos": [{}] if has_photo else [],
                "videos": [{}] if has_video else [],
            })

    async with AsyncSessionLocal() as db:
        from sqlalchemy import select
        existing = await db.execute(
            select(Post).where(Post.source_id == source.id, Post.external_id == eid)
        )
        if existing.scalar_one_or_none():
            return
        post = Post(
            source_id=source.id,
            external_id=eid,
            title=None,
            raw_text=text,
            cleaned_text=text,
            preview_text=make_preview(text),
            original_url=f"https://t.me/{username}/{event.message.id}",
            published_at=published_at or now,
            imported_at=now,
            updated_at=now,
            media_json=media_json,
        )
        db.add(post)
        src = await db.get(Source, source.id)
        if src:
            src.last_synced_at = now
        await db.commit()
    print(f"  + {source.title}: новый пост #{eid}")


async def main() -> None:
    settings = get_settings()
    api_id = (settings.telegram_api_id or "").strip()
    api_hash = (settings.telegram_api_hash or "").strip()
    if not api_id or not api_hash:
        print("Задайте TELEGRAM_API_ID и TELEGRAM_API_HASH в backend/.env")
        sys.exit(1)
    try:
        api_id_int = int(api_id)
    except ValueError:
        print("TELEGRAM_API_ID должен быть числом")
        sys.exit(1)
    session_path = settings.telegram_session_path or "./data/telegram_session"
    os.makedirs(os.path.dirname(session_path) or ".", exist_ok=True)

    client = TelegramClient(session_path, api_id_int, api_hash)
    await client.connect()

    if not await client.is_user_authorized():
        print("Сначала один раз войдите через: python -m scripts.telegram_sync")
        await client.disconnect()
        sys.exit(1)

    try:
        print("Загрузка каналов…")
        await load_sources(client)
        while not _channel_to_source:
            print("Нет активных Telegram-источников. Повтор через 30 с…")
            await asyncio.sleep(30)
            await load_sources(client)

        async def _reload_sources_loop() -> None:
            while True:
                await asyncio.sleep(_RELOAD_INTERVAL_SEC)
                await load_sources(client)
                client.remove_event_handler(on_new_message)
                client.add_event_handler(
                    on_new_message,
                    events.NewMessage(chats=list(_channel_to_source.keys())),
                )
                if _channel_to_source:
                    print("  Список каналов обновлён.")

        print("Реал-тайм включён — новые посты будут появляться в ленте. Список каналов обновляется каждые 90 с. Ctrl+C — выход.\n")
        client.add_event_handler(
            on_new_message,
            events.NewMessage(chats=list(_channel_to_source.keys())),
        )
        asyncio.create_task(_reload_sources_loop())
        await client.run_until_disconnected()
    finally:
        await client.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
