"""
Удаление постов старше N дней, если они не в избранном.
Также удаляет медиафайлы удалённых постов.

Запуск: python -m scripts.cleanup_old_posts
По умолчанию удаляет посты старше 10 дней.
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select, delete
from app.core.config import get_settings
from app.core.database import AsyncSessionLocal
from app.models.post import Post

# Директория медиа
_data_dir = os.environ.get("TELEGRAM_SESSION_PATH", "./data/telegram_session")
_data_dir = os.path.dirname(_data_dir) if "/" in _data_dir else "./data"
MEDIA_DIR = os.path.join(_data_dir, "media")

MAX_AGE_DAYS = int(os.environ.get("CLEANUP_MAX_AGE_DAYS", "10"))


def _delete_media_files(media_json: str | None, source_id: int | None) -> int:
    """Delete media files from disk. Returns number of files deleted."""
    if not media_json or not source_id:
        return 0
    deleted = 0
    try:
        data = json.loads(media_json)
        for photo in data.get("photos", []):
            url = photo.get("url", "")
            if url.startswith("/media/"):
                filepath = os.path.join(_data_dir, url.lstrip("/"))
                if os.path.isfile(filepath):
                    os.remove(filepath)
                    deleted += 1
    except Exception:
        pass
    return deleted


async def cleanup() -> tuple[int, int]:
    """Delete old non-favorite posts. Returns (posts_deleted, files_deleted)."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=MAX_AGE_DAYS)

    async with AsyncSessionLocal() as db:
        # Fetch posts to delete (need media_json for file cleanup)
        result = await db.execute(
            select(Post).where(
                Post.published_at < cutoff,
                Post.is_favorite == False,
            )
        )
        old_posts = list(result.scalars().all())

        if not old_posts:
            return 0, 0

        files_deleted = 0
        post_ids = []
        for p in old_posts:
            files_deleted += _delete_media_files(p.media_json, p.source_id)
            post_ids.append(p.id)

        # Delete posts in bulk
        await db.execute(delete(Post).where(Post.id.in_(post_ids)))
        await db.commit()

        return len(post_ids), files_deleted


async def main() -> None:
    posts_deleted, files_deleted = await cleanup()
    print(f"Очистка: удалено {posts_deleted} постов, {files_deleted} медиафайлов (старше {MAX_AGE_DAYS} дней, не в избранном)")


if __name__ == "__main__":
    asyncio.run(main())
