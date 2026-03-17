"""
Обновление аватаров у уже добавленных Telegram-каналов, у которых нет фото.
Запуск из папки backend:
  python -m scripts.update_source_avatars

Требуется рабочая Telegram-сессия (после хотя бы одного запуска telegram_sync)
и TELEGRAM_API_ID, TELEGRAM_API_HASH в .env.
"""
from __future__ import annotations

import asyncio
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.source import Source
from app.services.telegram_preview import get_channel_public_info


def get_channel_username(source: Source) -> str | None:
    """Достаёт username канала из config_json, url или slug."""
    if source.config_json:
        try:
            cfg = json.loads(source.config_json)
            if isinstance(cfg.get("channel_username"), str):
                s = cfg["channel_username"].strip().lstrip("@")
                if s:
                    return s
        except Exception:
            pass
    if source.url:
        url = source.url.strip()
        if "t.me/" in url:
            s = url.split("t.me/")[-1].split("/")[0].split("?")[0].strip().lstrip("@")
            if s:
                return s
    if source.slug and "-" in source.slug:
        s = source.slug.rsplit("-", 1)[-1].strip()
        if s and len(s) >= 2:
            return s
    return None


def has_avatar(config_json: str | None) -> bool:
    if not config_json:
        return False
    try:
        cfg = json.loads(config_json)
        return bool(cfg.get("avatar_base64"))
    except Exception:
        return False


async def main() -> None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Source).where(Source.type == "telegram")
        )
        sources = list(result.scalars().all())
        to_update = [s for s in sources if not has_avatar(s.config_json)]
        if not to_update:
            print("Нет каналов без аватара.")
            return
        print(f"Найдено каналов без аватара: {len(to_update)}")
        updated = 0
        for source in to_update:
            username = get_channel_username(source)
            if not username:
                print(f"  Пропуск '{source.title}' (id={source.id}): не удалось определить username")
                continue
            info = await get_channel_public_info(username)
            if not info.get("has_public_link"):
                print(f"  Пропуск '{source.title}' (@{username}): нет публичной ссылки")
                continue
            b64 = info.get("avatar_base64")
            if not b64:
                print(f"  Не удалось загрузить аватар для '{source.title}' (@{username})")
                continue
            try:
                cfg = json.loads(source.config_json) if source.config_json else {}
            except Exception:
                cfg = {}
            cfg["avatar_base64"] = b64
            if "channel_username" not in cfg:
                cfg["channel_username"] = username
            source.config_json = json.dumps(cfg)
            updated += 1
            print(f"  OK: {source.title} (@{username})")
        await db.commit()
        print(f"Обновлено аватаров: {updated}")


if __name__ == "__main__":
    asyncio.run(main())
