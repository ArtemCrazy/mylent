"""Утилиты для скачивания медиа из Telegram и формирования media_json."""
from __future__ import annotations

import json
import os

from telethon import TelegramClient
from telethon.tl.types import Message


# Базовая директория для медиа — рядом с сессией Telegram
_data_dir = os.environ.get("TELEGRAM_SESSION_PATH", "./data/telegram_session")
_data_dir = os.path.dirname(_data_dir) if "/" in _data_dir else "./data"
MEDIA_DIR = os.path.join(_data_dir, "media")
os.makedirs(MEDIA_DIR, exist_ok=True)


async def download_message_media(
    client: TelegramClient,
    msg: Message,
    source_id: int,
) -> str | None:
    """Download photo/video from message. Returns media_json string or None."""
    if not getattr(msg, "media", None):
        return None

    has_photo = msg.photo is not None
    has_video = (
        getattr(msg, "video", None) is not None
        or (
            getattr(msg, "document", None) is not None
            and (getattr(msg.document, "mime_type", None) or "").startswith("video/")
        )
    )

    if not has_photo and not has_video:
        return None

    photos = []
    videos = []
    msg_dir = os.path.join(MEDIA_DIR, str(source_id))
    os.makedirs(msg_dir, exist_ok=True)

    if has_photo:
        filename = f"{msg.id}.jpg"
        filepath = os.path.join(msg_dir, filename)
        try:
            await client.download_media(msg, file=filepath)
            photos.append({"url": f"/media/{source_id}/{filename}"})
        except Exception as e:
            print(f"    Ошибка скачивания фото {msg.id}: {e}")
            photos.append({})

    if has_video:
        # Видео не скачиваем (слишком большие), просто помечаем наличие
        videos.append({})

    return json.dumps({"photos": photos, "videos": videos})
