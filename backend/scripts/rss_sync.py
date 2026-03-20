import asyncio
import logging
from datetime import datetime, timezone
import feedparser
from bs4 import BeautifulSoup
from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.source import Source
from app.models.post import Post
from app.services.deduplicator import detect_and_mark_duplicate
from app.services.signals import check_post_signals

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)

def parse_date(date_string):
    import email.utils
    from email.utils import parsedate_to_datetime
    try:
        dt = parsedate_to_datetime(date_string)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return datetime.now(timezone.utc)

def make_preview(text: str, length: int = 150) -> str:
    """Обрезает текст до нужной длины с сохранением слов."""
    if not text:
        return ""
    if len(text) <= length:
        return text
    truncated = text[:length].rsplit(' ', 1)[0]
    return truncated + "..."

async def sync_rss():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Source).where(Source.type == "rss", Source.is_active == True))
        sources = result.scalars().all()
        
        for source in sources:
            logger.info(f"Syncing RSS source: {source.title}")
            try:
                import json
                config = json.loads(source.config_json or "{}")
                rss_url = config.get("rss_url") or source.url
                if not rss_url:
                    logger.warning(f"No RSS URL provided for source: {source.title}")
                    continue
                
                # Запрос ленты делаем в отдельном потоке, чтобы не блочить Event Loop
                loop = asyncio.get_running_loop()
                feed = await loop.run_in_executor(None, feedparser.parse, rss_url)
                
                added = 0
                now = datetime.now(timezone.utc)
                for entry in feed.entries:
                    link = getattr(entry, "link", "")
                    
                    # Проверяем на дубли по уникальной ссылке из RSS-фида
                    res = await db.execute(select(Post).where(Post.original_url == link))
                    if res.scalars().first():
                        continue
                        
                    title = getattr(entry, "title", None)
                    raw_html = getattr(entry, "description", "")
                    if not raw_html and hasattr(entry, "content"):
                        raw_html = entry.content[0].value
                    
                    cleaned_text = BeautifulSoup(raw_html, "html.parser").get_text(separator="\n").strip()
                    published_at = parse_date(getattr(entry, "published", None) or getattr(entry, "updated", None))
                    
                    # External ID для новостных лент это обычно хвост ссылки или GUID
                    eid = getattr(entry, "id", link)
                    if not eid:
                        continue
                        
                    post = Post(
                        source_id=source.id,
                        external_id=str(eid)[:250],
                        title=title,
                        raw_text=raw_html,
                        cleaned_text=cleaned_text,
                        preview_text=make_preview(cleaned_text),
                        original_url=link,
                        published_at=published_at,
                        imported_at=now,
                        updated_at=now,
                    )
                    db.add(post)
                    await db.flush()  # Получаем ID поста
                    await check_post_signals(db, post.id, source.id, cleaned_text)
                    await detect_and_mark_duplicate(db, post)
                    added += 1
                
                if added > 0:
                    source.last_synced_at = now
                logger.info(f"RSS {source.title} sync complete. Added {added} posts.")
            except Exception as e:
                logger.error(f"Failed to sync RSS {source.title}: {e}")
                
        await db.commit()

def main():
    asyncio.run(sync_rss())

if __name__ == "__main__":
    main()
