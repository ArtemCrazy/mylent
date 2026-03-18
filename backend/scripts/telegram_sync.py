"""
Импорт постов из Telegram-каналов в ленту.
Запуск из папки backend:
  python -m scripts.telegram_sync

Первый запуск: нужны TELEGRAM_API_ID и TELEGRAM_API_HASH в .env (получить на my.telegram.org).
При первом входе скрипт запросит номер телефона и код из Telegram.
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
from datetime import datetime, timezone

# чтобы из backend/scripts подниматься до backend и импортировать app
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from telethon import TelegramClient
from telethon.tl.types import Message

from app.core.config import get_settings
from app.core.database import AsyncSessionLocal
from app.models.post import Post
from app.models.source import Source
from app.services.telegram_preview import entity_has_public_link
from app.services.signal_matcher import check_post_signals
from scripts.media_utils import download_message_media, message_to_html


def get_channel_username(source: Source) -> str | None:
    """Достаёт username канала из config_json или url."""
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


async def fetch_and_save(client: TelegramClient, db: AsyncSession) -> int:
    """Загружает посты из всех активных Telegram-источников. Возвращает количество добавленных постов."""
    result = await db.execute(
        select(Source).where(Source.type == "telegram", Source.is_active == True)
    )
    sources = list(result.scalars().all())
    if not sources:
        print("Нет активных Telegram-источников.")
        return 0

    total_added = 0
    now = datetime.now(timezone.utc)

    for source in sources:
        username = get_channel_username(source)
        if not username:
            print(f"  Пропуск '{source.title}': не указан username канала")
            continue

        try:
            entity = await client.get_entity(username)

            if not entity_has_public_link(entity):
                print(f"  Пропуск '{source.title}': нет публичной ссылки (только приглашение), парсить нельзя")
                continue

            messages = await client.get_messages(entity, limit=50)
        except Exception as e:
            print(f"  Ошибка канала '{source.title}' ({username}): {e}")
            continue

        existing = await db.execute(
            select(Post.external_id).where(Post.source_id == source.id)
        )
        existing_ids = set(existing.scalars().all())

        added = 0
        for msg in messages:
            if not isinstance(msg, Message):
                continue
            text = (msg.message or msg.text or "").strip()
            if not text:
                continue
            eid = str(msg.id)
            if eid in existing_ids:
                continue

            published_at = msg.date
            if published_at and published_at.tzinfo is None:
                published_at = published_at.replace(tzinfo=timezone.utc)

            try:
                media_json = await download_message_media(client, msg, source.id)
            except Exception as e:
                print(f"    Ошибка медиа {msg.id}: {e}")
                media_json = None
            html_text = message_to_html(msg)

            post = Post(
                source_id=source.id,
                external_id=eid,
                title=None,
                raw_text=text,
                cleaned_text=html_text,
                preview_text=make_preview(text),
                original_url=f"https://t.me/{username}/{msg.id}",
                published_at=published_at or now,
                imported_at=now,
                updated_at=now,
                media_json=media_json,
            )
            db.add(post)
            await db.flush()
            await check_post_signals(db, post.id, source.id, text)
            existing_ids.add(eid)
            added += 1

        if added > 0:
            source.last_synced_at = now
            total_added += added
            await db.commit()
            print(f"  {source.title}: добавлено {added} постов")

    return total_added


async def main() -> None:
    settings = get_settings()
    api_id = (settings.telegram_api_id or "").strip()
    api_hash = (settings.telegram_api_hash or "").strip()
    if not api_id or not api_hash:
        print("Задайте TELEGRAM_API_ID и TELEGRAM_API_HASH в backend/.env (получить на https://my.telegram.org)")
        sys.exit(1)
    try:
        api_id_int = int(api_id)
    except ValueError:
        print("TELEGRAM_API_ID должен быть числом")
        sys.exit(1)

    session_path = settings.telegram_session_path or "./data/telegram_session"
    os.makedirs(os.path.dirname(session_path) or ".", exist_ok=True)

    print("Подключение к Telegram…")
    client = TelegramClient(session_path, api_id_int, api_hash)
    await client.connect()

    if not await client.is_user_authorized():
        # Интерактивный режим (первый запуск вручную) — только если есть stdin
        if sys.stdin.isatty():
            print("Первый запуск: войдите в аккаунт Telegram (код придёт в приложение Telegram).")
            await client.start()
        else:
            print("Сессия не авторизована. Войдите вручную: docker exec -it mylent-backend-1 python -m scripts.telegram_sync")
            await client.disconnect()
            sys.exit(1)

    try:
        print("Синхронизация каналов…")
        async with AsyncSessionLocal() as db:
            try:
                added = await fetch_and_save(client, db)
                await db.commit()
                print(f"Готово. Добавлено постов: {added}")
            except Exception as e:
                await db.rollback()
                print(f"Ошибка синхронизации: {e}")
    finally:
        try:
            await client.disconnect()
        except Exception:
            pass


if __name__ == "__main__":
    asyncio.run(main())
