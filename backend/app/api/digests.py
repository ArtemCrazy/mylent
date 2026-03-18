import logging
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, status, Query
from sqlalchemy import select
from app.schemas.digest import DigestResponse, DigestGenerateRequest
from app.api.deps import CurrentUser, DbSession
from app.models.digest import Digest
from app.services.digest_generator import generate_digest as do_generate

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/digests", tags=["digests"])


@router.get("", response_model=list[DigestResponse])
async def list_digests(
    db: DbSession,
    current_user: CurrentUser,
    type: str | None = None,
    limit: int = Query(20, le=50),
    offset: int = 0,
):
    q = select(Digest).order_by(Digest.created_at.desc()).offset(offset).limit(limit)
    if type:
        q = q.where(Digest.type == type)
    result = await db.execute(q)
    return list(result.scalars().all())


@router.get("/{digest_id}", response_model=DigestResponse)
async def get_digest(digest_id: int, db: DbSession, current_user: CurrentUser):
    result = await db.execute(select(Digest).where(Digest.id == digest_id))
    d = result.scalar_one_or_none()
    if not d:
        raise HTTPException(status_code=404, detail="Digest not found")
    return d


@router.post("/generate", response_model=DigestResponse, status_code=status.HTTP_201_CREATED)
async def generate_digest_endpoint(body: DigestGenerateRequest, db: DbSession, current_user: CurrentUser):
    try:
        digest = await do_generate(
            db=db,
            period_start=body.period_start,
            period_end=body.period_end,
            digest_type=body.type,
        )
        return digest
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Digest generation failed")
        raise HTTPException(status_code=500, detail=f"Ошибка генерации: {str(e)}")
