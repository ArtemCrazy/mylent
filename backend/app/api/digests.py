"""API for Digests — configurable AI-powered news summaries."""
from __future__ import annotations

import logging
from fastapi import APIRouter, HTTPException, status, Query
from sqlalchemy import select, func, delete
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentUser, DbSession
from app.models.digest import Digest, DigestConfig, DigestConfigSource
from app.schemas.digest import (
    DigestResponse, DigestGenerateRequest,
    DigestConfigCreate, DigestConfigUpdate, DigestConfigResponse, DigestConfigSourceRef,
)
from app.services.digest_generator import generate_digest as do_generate

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/digests", tags=["digests"])


# ── Helper ──

def _config_to_response(cfg: DigestConfig, last_digest: Digest | None = None, digest_count: int = 0) -> DigestConfigResponse:
    return DigestConfigResponse(
        id=cfg.id,
        name=cfg.name,
        prompt=cfg.prompt,
        schedule_type=cfg.schedule_type,
        schedule_hours=cfg.schedule_hours,
        period_hours=cfg.period_hours,
        is_active=cfg.is_active,
        created_at=cfg.created_at,
        sources=[
            DigestConfigSourceRef(id=cs.source.id, title=cs.source.title, category=cs.source.category)
            for cs in cfg.sources if cs.source
        ],
        last_digest=_digest_to_response(last_digest) if last_digest else None,
        digest_count=digest_count,
    )


def _digest_to_response(d: Digest) -> DigestResponse:
    return DigestResponse(
        id=d.id,
        config_id=d.config_id,
        config_name=d.config.name if d.config else None,
        type=d.type,
        title=d.title,
        period_start=d.period_start,
        period_end=d.period_end,
        summary=d.summary,
        items_json=d.items_json,
        created_at=d.created_at,
    )


# ── Config CRUD (MUST be before /{digest_id} to avoid path conflicts) ──

@router.get("/configs", response_model=list[DigestConfigResponse])
async def list_configs(user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(DigestConfig)
        .where(DigestConfig.user_id == user.id)
        .options(
            selectinload(DigestConfig.sources).selectinload(DigestConfigSource.source),
        )
        .order_by(DigestConfig.created_at.desc())
    )
    configs = list(result.scalars().all())

    # Get last digest and count per config
    responses = []
    for cfg in configs:
        # Last digest
        last_result = await db.execute(
            select(Digest)
            .where(Digest.config_id == cfg.id)
            .order_by(Digest.created_at.desc())
            .limit(1)
        )
        last_digest = last_result.scalar_one_or_none()

        # Count
        cnt_result = await db.execute(
            select(func.count(Digest.id)).where(Digest.config_id == cfg.id)
        )
        count = cnt_result.scalar() or 0

        responses.append(_config_to_response(cfg, last_digest, count))
    return responses


@router.post("/configs", response_model=DigestConfigResponse, status_code=status.HTTP_201_CREATED)
async def create_config(body: DigestConfigCreate, user: CurrentUser, db: DbSession):
    cfg = DigestConfig(
        user_id=user.id,
        name=body.name,
        prompt=body.prompt,
        schedule_type=body.schedule_type,
        schedule_hours=body.schedule_hours,
        period_hours=body.period_hours,
    )
    db.add(cfg)
    await db.flush()
    for sid in body.source_ids:
        db.add(DigestConfigSource(config_id=cfg.id, source_id=sid))
    await db.flush()
    # Reload with relationships
    result = await db.execute(
        select(DigestConfig)
        .where(DigestConfig.id == cfg.id)
        .options(selectinload(DigestConfig.sources).selectinload(DigestConfigSource.source))
    )
    cfg = result.scalar_one()
    return _config_to_response(cfg)


@router.get("/configs/{config_id}", response_model=DigestConfigResponse)
async def get_config(config_id: int, user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(DigestConfig)
        .where(DigestConfig.id == config_id, DigestConfig.user_id == user.id)
        .options(selectinload(DigestConfig.sources).selectinload(DigestConfigSource.source))
    )
    cfg = result.scalar_one_or_none()
    if not cfg:
        raise HTTPException(status_code=404, detail="Config not found")

    last_result = await db.execute(
        select(Digest).where(Digest.config_id == cfg.id).order_by(Digest.created_at.desc()).limit(1)
    )
    last_digest = last_result.scalar_one_or_none()
    cnt = (await db.execute(select(func.count(Digest.id)).where(Digest.config_id == cfg.id))).scalar() or 0

    return _config_to_response(cfg, last_digest, cnt)


@router.patch("/configs/{config_id}", response_model=DigestConfigResponse)
async def update_config(config_id: int, body: DigestConfigUpdate, user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(DigestConfig)
        .where(DigestConfig.id == config_id, DigestConfig.user_id == user.id)
        .options(selectinload(DigestConfig.sources).selectinload(DigestConfigSource.source))
    )
    cfg = result.scalar_one_or_none()
    if not cfg:
        raise HTTPException(status_code=404, detail="Config not found")

    if body.name is not None:
        cfg.name = body.name
    if body.prompt is not None:
        cfg.prompt = body.prompt
    if body.schedule_type is not None:
        cfg.schedule_type = body.schedule_type
    if body.schedule_hours is not None:
        cfg.schedule_hours = body.schedule_hours
    if body.period_hours is not None:
        cfg.period_hours = body.period_hours
    if body.is_active is not None:
        cfg.is_active = body.is_active
    if body.source_ids is not None:
        await db.execute(delete(DigestConfigSource).where(DigestConfigSource.config_id == cfg.id))
        for sid in body.source_ids:
            db.add(DigestConfigSource(config_id=cfg.id, source_id=sid))
    await db.flush()

    # Reload
    result = await db.execute(
        select(DigestConfig)
        .where(DigestConfig.id == cfg.id)
        .options(selectinload(DigestConfig.sources).selectinload(DigestConfigSource.source))
    )
    cfg = result.scalar_one()
    return _config_to_response(cfg)


@router.delete("/configs/{config_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_config(config_id: int, user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(DigestConfig).where(DigestConfig.id == config_id, DigestConfig.user_id == user.id)
    )
    cfg = result.scalar_one_or_none()
    if not cfg:
        raise HTTPException(status_code=404, detail="Config not found")
    await db.delete(cfg)


@router.post("/configs/{config_id}/generate", response_model=DigestResponse, status_code=status.HTTP_201_CREATED)
async def generate_from_config(config_id: int, user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(DigestConfig)
        .where(DigestConfig.id == config_id, DigestConfig.user_id == user.id)
        .options(selectinload(DigestConfig.sources).selectinload(DigestConfigSource.source))
    )
    cfg = result.scalar_one_or_none()
    if not cfg:
        raise HTTPException(status_code=404, detail="Config not found")
    try:
        digest = await do_generate(db=db, config=cfg)
        return _digest_to_response(digest)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Digest generation failed")
        raise HTTPException(status_code=500, detail=f"Ошибка генерации: {str(e)}")


@router.get("/configs/{config_id}/history", response_model=list[DigestResponse])
async def config_history(
    config_id: int, user: CurrentUser, db: DbSession,
    limit: int = Query(20, le=50), offset: int = 0,
):
    # Verify ownership
    cfg = (await db.execute(
        select(DigestConfig).where(DigestConfig.id == config_id, DigestConfig.user_id == user.id)
    )).scalar_one_or_none()
    if not cfg:
        raise HTTPException(status_code=404, detail="Config not found")

    result = await db.execute(
        select(Digest)
        .where(Digest.config_id == config_id)
        .order_by(Digest.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    digests = list(result.scalars().all())
    return [_digest_to_response(d) for d in digests]


# ── Legacy digest endpoints ──

@router.get("", response_model=list[DigestResponse])
async def list_digests(
    db: DbSession,
    current_user: CurrentUser,
    type: str | None = None,
    config_id: int | None = None,
    limit: int = Query(20, le=50),
    offset: int = 0,
):
    q = select(Digest).order_by(Digest.created_at.desc()).offset(offset).limit(limit)
    if type:
        q = q.where(Digest.type == type)
    if config_id:
        q = q.where(Digest.config_id == config_id)
    result = await db.execute(q)
    return list(result.scalars().all())


@router.get("/{digest_id}", response_model=DigestResponse)
async def get_digest(digest_id: int, db: DbSession, current_user: CurrentUser):
    result = await db.execute(
        select(Digest)
        .where(Digest.id == digest_id)
        .options(selectinload(Digest.config))
    )
    d = result.scalar_one_or_none()
    if not d:
        raise HTTPException(status_code=404, detail="Digest not found")
    return _digest_to_response(d)


@router.post("/generate", response_model=DigestResponse, status_code=status.HTTP_201_CREATED)
async def generate_digest_endpoint(body: DigestGenerateRequest, db: DbSession, current_user: CurrentUser):
    try:
        digest = await do_generate(
            db=db,
            period_start=body.period_start,
            period_end=body.period_end,
            digest_type=body.type,
        )
        return _digest_to_response(digest)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Digest generation failed")
        raise HTTPException(status_code=500, detail=f"Ошибка генерации: {str(e)}")
