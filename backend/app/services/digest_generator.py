"""
Digest generation service — fetches recent posts and calls DeepSeek API
to produce a structured news summary.
"""
import json
import logging
from datetime import datetime, timedelta, timezone

from openai import AsyncOpenAI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.config import get_settings
from app.models.digest import Digest
from app.models.post import Post
from app.models.source import Source

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """Ты — AI-редактор новостной ленты. Тебе дан список постов из Telegram-каналов за определённый период.

Твоя задача — составить краткий дайджест на русском языке:
1. Начни с общего резюме (2-3 предложения): что было главным за период.
2. Затем выдели 5-10 ключевых тем/новостей, сгруппировав связанные посты.
3. Для каждой темы дай:
   - Заголовок темы (жирный)
   - Краткое описание (2-3 предложения)
   - Номера постов [#id], чтобы можно было перейти к оригиналу.

Формат ответа — Markdown. Будь лаконичен, информативен и нейтрален.
Не выдумывай информацию, только суммируй то, что есть в постах."""


async def generate_digest(
    db: AsyncSession,
    period_start: datetime | None = None,
    period_end: datetime | None = None,
    digest_type: str = "daily",
) -> Digest:
    settings = get_settings()

    if not settings.deepseek_api_key:
        raise ValueError("DEEPSEEK_API_KEY не настроен. Добавьте ключ в .env")

    now = datetime.now(timezone.utc)
    if period_end is None:
        period_end = now
    if period_start is None:
        period_start = period_end - timedelta(hours=8)

    # Fetch posts for the period with their sources
    stmt = (
        select(Post)
        .options(joinedload(Post.source))
        .where(
            Post.published_at >= period_start,
            Post.published_at <= period_end,
            Post.is_hidden == False,
        )
        .order_by(Post.published_at.desc())
        .limit(200)
    )
    result = await db.execute(stmt)
    posts = list(result.scalars().unique().all())

    if not posts:
        digest = Digest(
            type=digest_type,
            title=_make_title(period_start, period_end),
            period_start=period_start,
            period_end=period_end,
            summary="За выбранный период новых постов не найдено.",
            items_json=json.dumps([]),
        )
        db.add(digest)
        await db.flush()
        await db.refresh(digest)
        return digest

    # Build prompt with posts
    posts_text = _format_posts_for_prompt(posts)
    period_label = _period_label(period_start, period_end)

    user_prompt = f"Период: {period_label}\nВсего постов: {len(posts)}\n\n{posts_text}"

    # Call DeepSeek via OpenAI-compatible API
    client = AsyncOpenAI(
        api_key=settings.deepseek_api_key,
        base_url=settings.deepseek_base_url,
    )

    logger.info(f"Generating digest: {len(posts)} posts, period {period_label}")

    response = await client.chat.completions.create(
        model=settings.deepseek_model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        max_tokens=4000,
        temperature=0.3,
    )

    ai_summary = response.choices[0].message.content or ""

    # Build items_json with post references
    items = []
    for p in posts[:50]:  # top 50 for the items list
        items.append({
            "post_id": p.id,
            "title": p.title or (p.preview_text[:80] if p.preview_text else p.raw_text[:80]),
            "source_title": p.source.title if p.source else None,
            "published_at": p.published_at.isoformat() if p.published_at else None,
        })

    digest = Digest(
        type=digest_type,
        title=_make_title(period_start, period_end),
        period_start=period_start,
        period_end=period_end,
        summary=ai_summary,
        items_json=json.dumps(items, ensure_ascii=False),
    )
    db.add(digest)
    await db.flush()
    await db.refresh(digest)

    logger.info(f"Digest #{digest.id} created: {len(items)} items")
    return digest


def _format_posts_for_prompt(posts: list[Post], max_chars: int = 30000) -> str:
    """Format posts into a text block for the AI prompt, respecting token limits."""
    lines = []
    total = 0
    for p in posts:
        source_name = p.source.title if p.source else "?"
        text = (p.cleaned_text or p.raw_text or "").strip()
        if len(text) > 500:
            text = text[:500] + "…"
        line = f"[#{p.id}] [{source_name}] {text}"
        if total + len(line) > max_chars:
            lines.append(f"... и ещё {len(posts) - len(lines)} постов")
            break
        lines.append(line)
        total += len(line)
    return "\n\n".join(lines)


def _make_title(start: datetime, end: datetime) -> str:
    """Generate a human-readable digest title."""
    fmt = "%d.%m.%Y %H:%M"
    return f"Дайджест {start.strftime(fmt)} — {end.strftime(fmt)}"


def _period_label(start: datetime, end: datetime) -> str:
    fmt = "%d %B %Y, %H:%M"
    return f"{start.strftime(fmt)} — {end.strftime(fmt)}"
