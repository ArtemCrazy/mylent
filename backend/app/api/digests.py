from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, status, Query
from sqlalchemy import select
from app.schemas.digest import DigestResponse, DigestGenerateRequest
from app.api.deps import CurrentUser, DbSession
from app.models.digest import Digest
import json

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
async def generate_digest(body: DigestGenerateRequest, db: DbSession, current_user: CurrentUser):
    # Placeholder: create a minimal digest record. Real implementation will call AI and fetch posts.
    now = datetime.utcnow()
    period_end = body.period_end or now
    period_start = body.period_start or (period_end - timedelta(days=1))
    digest = Digest(
        type=body.type,
        title=f"Digest: {body.type}",
        period_start=period_start,
        period_end=period_end,
        summary=None,
        items_json=json.dumps([]),
    )
    db.add(digest)
    await db.flush()
    await db.refresh(digest)
    return digest
