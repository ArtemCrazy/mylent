"""Утилиты для скачивания медиа из Telegram и формирования media_json."""
from __future__ import annotations

import html as html_module
import json
import os

from telethon import TelegramClient
from telethon.tl.types import (
    Message,
    MessageEntityUrl,
    MessageEntityTextUrl,
    MessageEntityBold,
    MessageEntityItalic,
)


# Базовая директория для медиа — рядом с сессией Telegram
_data_dir = os.environ.get("TELEGRAM_SESSION_PATH", "./data/telegram_session")
_data_dir = os.path.dirname(_data_dir) if "/" in _data_dir else "./data"
MEDIA_DIR = os.path.join(_data_dir, "media")
os.makedirs(MEDIA_DIR, exist_ok=True)

# Максимальный размер видео для скачивания (байты). Больше — только ссылка на источник.
MAX_VIDEO_SIZE = int(os.environ.get("MAX_VIDEO_SIZE_MB", "20")) * 1024 * 1024


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
            import asyncio
            await asyncio.wait_for(client.download_media(msg, file=filepath), timeout=60.0)
            photos.append({"url": f"/media/{source_id}/{filename}"})
        except Exception as e:
            print(f"    Ошибка скачивания фото {msg.id}: {e}")
            photos.append({})

    if has_video:
        video_doc = getattr(msg, "video", None) or getattr(msg, "document", None)
        video_size = getattr(video_doc, "size", 0) or 0
        mime = getattr(video_doc, "mime_type", "video/mp4") or "video/mp4"
        ext = "mp4" if "mp4" in mime else mime.split("/")[-1]
        if video_size <= MAX_VIDEO_SIZE:
            filename = f"{msg.id}.{ext}"
            filepath = os.path.join(msg_dir, filename)
            try:
                import asyncio
                await asyncio.wait_for(client.download_media(msg, file=filepath), timeout=300.0)
                videos.append({"url": f"/media/{source_id}/{filename}"})
            except Exception as e:
                print(f"    Ошибка скачивания видео {msg.id}: {e}")
                videos.append({})
        else:
            print(f"    Видео {msg.id} слишком большое ({video_size // 1024 // 1024} МБ > {MAX_VIDEO_SIZE // 1024 // 1024} МБ), пропуск")
            videos.append({})

    return json.dumps({"photos": photos, "videos": videos})


def _utf16_to_py_offsets(text: str) -> list[int]:
    """Build mapping: utf16_offset -> python string index.

    Telegram entity offsets/lengths are in UTF-16 code units.
    Characters outside BMP (emojis etc.) take 2 UTF-16 units but 1 Python char.
    """
    mapping: list[int] = []
    for i, ch in enumerate(text):
        mapping.append(i)
        if ord(ch) > 0xFFFF:
            mapping.append(i)  # surrogate pair — 2 UTF-16 units, same Python index
    mapping.append(len(text))  # sentinel for end offset
    return mapping


def message_to_html(msg: Message) -> str:
    """Convert Telegram message text + entities to HTML with links preserved."""
    text = msg.message or msg.text or ""
    if not text:
        return ""
    entities = msg.entities or []
    if not entities:
        return html_module.escape(text)

    # Build UTF-16 → Python offset mapping
    u16map = _utf16_to_py_offsets(text)

    def _py(offset: int) -> int:
        """Convert UTF-16 offset to Python string index (clamped)."""
        return u16map[min(offset, len(u16map) - 1)]

    # Sort entities by offset
    sorted_ents = sorted(entities, key=lambda e: e.offset)

    result = []
    last_end = 0  # Python string index

    for ent in sorted_ents:
        start = _py(ent.offset)
        end = _py(ent.offset + ent.length)
        # Skip entities entirely within already-processed text (overlapping entities)
        if end <= last_end:
            continue
        # Trim overlap if entity partially overlaps with already-processed text
        if start < last_end:
            start = last_end
        # Add text before this entity
        if start > last_end:
            result.append(html_module.escape(text[last_end:start]))

        chunk = html_module.escape(text[start:end])

        if isinstance(ent, MessageEntityTextUrl):
            url = html_module.escape(ent.url, quote=True)
            result.append(f'<a href="{url}" target="_blank" rel="noopener noreferrer">{chunk}</a>')
        elif isinstance(ent, MessageEntityUrl):
            result.append(f'<a href="{text[start:end]}" target="_blank" rel="noopener noreferrer">{chunk}</a>')
        elif isinstance(ent, MessageEntityBold):
            result.append(f"<b>{chunk}</b>")
        elif isinstance(ent, MessageEntityItalic):
            result.append(f"<i>{chunk}</i>")
        else:
            result.append(chunk)

        last_end = end

    # Add remaining text
    if last_end < len(text):
        result.append(html_module.escape(text[last_end:]))

    return "".join(result)
