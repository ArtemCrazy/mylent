import json
import logging
import traceback
from fastapi import APIRouter, HTTPException, status, Query
from app.schemas.source import SourceCreate, SourceUpdate, SourceResponse
from app.api.deps import CurrentUser, DbSession
from app.models.source import Source
from app.services.telegram_preview import get_channel_public_info
from sqlalchemy import select

log = logging.getLogger(__name__)
router = APIRouter(prefix="/sources", tags=["sources"])


@router.get("/channel-preview")
async def channel_preview(current_user: CurrentUser, username: str = Query(..., min_length=1)):
    """Превью аватара канала по username (для формы добавления). Без публичной ссылки — парсить нельзя."""
    info = await get_channel_public_info(username)
    return {"has_public_link": info["has_public_link"], "avatar_base64": info.get("avatar_base64")}


@router.get("", response_model=list[SourceResponse])
async def list_sources(db: DbSession, current_user: CurrentUser):
    result = await db.execute(select(Source).order_by(Source.priority.desc(), Source.title))
    return list(result.scalars().all())


@router.post("", response_model=SourceResponse, status_code=status.HTTP_201_CREATED)
async def create_source(body: SourceCreate, db: DbSession, current_user: CurrentUser):
    try:
        existing = await db.execute(select(Source).where(Source.slug == body.slug))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Source with this slug already exists")
        source = Source(
            type=body.type,
            title=body.title,
            slug=body.slug,
            category=body.category or "other",
            url=body.url,
            is_active=body.is_active,
            show_in_feed=body.show_in_feed,
            priority=body.priority,
            config_json=body.config_json,
        )
        db.add(source)
        await db.flush()
        await db.refresh(source)
        return source
    except HTTPException:
        raise
    except Exception as e:
        log.error("create_source error: %s\n%s", e, traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"DB error: {type(e).__name__}: {e}")


@router.get("/{source_id}", response_model=SourceResponse)
async def get_source(source_id: int, db: DbSession, current_user: CurrentUser):
    result = await db.execute(select(Source).where(Source.id == source_id))
    source = result.scalar_one_or_none()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    return source


@router.patch("/{source_id}", response_model=SourceResponse)
async def update_source(source_id: int, body: SourceUpdate, db: DbSession, current_user: CurrentUser):
    result = await db.execute(select(Source).where(Source.id == source_id))
    source = result.scalar_one_or_none()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(source, k, v)
    await db.flush()
    await db.refresh(source)
    return source


@router.delete("/{source_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_source(source_id: int, db: DbSession, current_user: CurrentUser):
    result = await db.execute(select(Source).where(Source.id == source_id))
    source = result.scalar_one_or_none()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    await db.delete(source)
    return None
