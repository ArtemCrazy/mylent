"""API for Signals — keyword-based alerts on posts from selected sources."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select, func, delete
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentUser, DbSession
from app.models.signal import Signal, SignalSource, SignalAsset, SignalAlert
from app.models.source import Source
from app.schemas.signal import (
    SignalCreate, SignalUpdate, SignalResponse, SignalSourceRef,
    SignalAssetCreate, SignalAssetResponse,
    SignalAlertResponse, SignalAlertPostRef,
)

router = APIRouter(prefix="/signals", tags=["signals"])


def _signal_to_response(sig: Signal, unread: int = 0) -> SignalResponse:
    return SignalResponse(
        id=sig.id,
        name=sig.name,
        type=sig.type,
        is_active=sig.is_active,
        created_at=sig.created_at,
        sources=[
            SignalSourceRef(id=ss.source.id, title=ss.source.title, category=ss.source.category)
            for ss in sig.sources if ss.source
        ],
        assets=[
            SignalAssetResponse(id=a.id, name=a.name, ticker=a.ticker, keywords=a.keywords)
            for a in sig.assets
        ],
        unread_count=unread,
    )


# ── Unread alerts count (for polling / notifications) — MUST be before /{signal_id} ──

@router.get("/alerts/unread-count")
async def unread_alerts_count(user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(func.count(SignalAlert.id))
        .join(Signal)
        .where(Signal.user_id == user.id, SignalAlert.is_read == False)
    )
    return {"count": result.scalar() or 0}


# ── CRUD Signals ──

@router.get("", response_model=list[SignalResponse])
async def list_signals(user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(Signal)
        .where(Signal.user_id == user.id)
        .options(
            selectinload(Signal.sources).selectinload(SignalSource.source),
            selectinload(Signal.assets),
        )
        .order_by(Signal.created_at.desc())
    )
    signals = list(result.scalars().all())
    # Count unread alerts per signal
    unread_counts: dict[int, int] = {}
    if signals:
        sig_ids = [s.id for s in signals]
        cnt_result = await db.execute(
            select(SignalAlert.signal_id, func.count(SignalAlert.id))
            .where(SignalAlert.signal_id.in_(sig_ids), SignalAlert.is_read == False)
            .group_by(SignalAlert.signal_id)
        )
        unread_counts = dict(cnt_result.all())
    return [_signal_to_response(s, unread_counts.get(s.id, 0)) for s in signals]


@router.post("", response_model=SignalResponse, status_code=status.HTTP_201_CREATED)
async def create_signal(body: SignalCreate, user: CurrentUser, db: DbSession):
    sig = Signal(user_id=user.id, name=body.name, type=body.type)
    db.add(sig)
    await db.flush()
    # Add sources
    for sid in body.source_ids:
        db.add(SignalSource(signal_id=sig.id, source_id=sid))
    # Add assets
    for a in body.assets:
        db.add(SignalAsset(signal_id=sig.id, name=a.name, ticker=a.ticker, keywords=a.keywords))
    await db.flush()
    # Reload with relationships
    result = await db.execute(
        select(Signal)
        .where(Signal.id == sig.id)
        .options(
            selectinload(Signal.sources).selectinload(SignalSource.source),
            selectinload(Signal.assets),
        )
    )
    sig = result.scalar_one()
    return _signal_to_response(sig)


@router.get("/{signal_id}", response_model=SignalResponse)
async def get_signal(signal_id: int, user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(Signal)
        .where(Signal.id == signal_id, Signal.user_id == user.id)
        .options(
            selectinload(Signal.sources).selectinload(SignalSource.source),
            selectinload(Signal.assets),
        )
    )
    sig = result.scalar_one_or_none()
    if not sig:
        raise HTTPException(status_code=404, detail="Signal not found")
    # Unread count
    cnt = await db.execute(
        select(func.count(SignalAlert.id))
        .where(SignalAlert.signal_id == sig.id, SignalAlert.is_read == False)
    )
    return _signal_to_response(sig, cnt.scalar() or 0)


@router.patch("/{signal_id}", response_model=SignalResponse)
async def update_signal(signal_id: int, body: SignalUpdate, user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(Signal)
        .where(Signal.id == signal_id, Signal.user_id == user.id)
        .options(
            selectinload(Signal.sources).selectinload(SignalSource.source),
            selectinload(Signal.assets),
        )
    )
    sig = result.scalar_one_or_none()
    if not sig:
        raise HTTPException(status_code=404, detail="Signal not found")
    if body.name is not None:
        sig.name = body.name
    if body.is_active is not None:
        sig.is_active = body.is_active
    if body.source_ids is not None:
        await db.execute(delete(SignalSource).where(SignalSource.signal_id == sig.id))
        for sid in body.source_ids:
            db.add(SignalSource(signal_id=sig.id, source_id=sid))
    await db.flush()
    # Reload
    result = await db.execute(
        select(Signal)
        .where(Signal.id == sig.id)
        .options(
            selectinload(Signal.sources).selectinload(SignalSource.source),
            selectinload(Signal.assets),
        )
    )
    sig = result.scalar_one()
    return _signal_to_response(sig)


@router.delete("/{signal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_signal(signal_id: int, user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(Signal).where(Signal.id == signal_id, Signal.user_id == user.id)
    )
    sig = result.scalar_one_or_none()
    if not sig:
        raise HTTPException(status_code=404, detail="Signal not found")
    await db.delete(sig)


# ── Assets CRUD ──

@router.post("/{signal_id}/assets", response_model=SignalAssetResponse, status_code=status.HTTP_201_CREATED)
async def add_asset(signal_id: int, body: SignalAssetCreate, user: CurrentUser, db: DbSession):
    sig = (await db.execute(
        select(Signal).where(Signal.id == signal_id, Signal.user_id == user.id)
    )).scalar_one_or_none()
    if not sig:
        raise HTTPException(status_code=404, detail="Signal not found")
    asset = SignalAsset(signal_id=sig.id, name=body.name, ticker=body.ticker, keywords=body.keywords)
    db.add(asset)
    await db.flush()
    return SignalAssetResponse(id=asset.id, name=asset.name, ticker=asset.ticker, keywords=asset.keywords)


@router.delete("/{signal_id}/assets/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_asset(signal_id: int, asset_id: int, user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(SignalAsset)
        .join(Signal)
        .where(SignalAsset.id == asset_id, Signal.id == signal_id, Signal.user_id == user.id)
    )
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    await db.delete(asset)


# ── Alerts ──

@router.get("/{signal_id}/alerts", response_model=list[SignalAlertResponse])
async def list_alerts(signal_id: int, user: CurrentUser, db: DbSession, limit: int = 50, offset: int = 0):
    sig = (await db.execute(
        select(Signal).where(Signal.id == signal_id, Signal.user_id == user.id)
    )).scalar_one_or_none()
    if not sig:
        raise HTTPException(status_code=404, detail="Signal not found")
    result = await db.execute(
        select(SignalAlert)
        .where(SignalAlert.signal_id == signal_id)
        .options(
            selectinload(SignalAlert.asset),
            selectinload(SignalAlert.post),
        )
        .order_by(SignalAlert.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    alerts = list(result.scalars().all())
    out = []
    for a in alerts:
        post = a.post
        out.append(SignalAlertResponse(
            id=a.id,
            signal_id=a.signal_id,
            matched_keyword=a.matched_keyword,
            is_read=a.is_read,
            created_at=a.created_at,
            asset=SignalAssetResponse(id=a.asset.id, name=a.asset.name, ticker=a.asset.ticker, keywords=a.asset.keywords),
            post=SignalAlertPostRef(
                id=post.id,
                title=post.title,
                preview_text=post.preview_text,
                original_url=post.original_url,
                published_at=post.published_at,
                source_title=None,
            ),
        ))
    return out


@router.post("/{signal_id}/alerts/read-all", status_code=status.HTTP_204_NO_CONTENT)
async def mark_all_alerts_read(signal_id: int, user: CurrentUser, db: DbSession):
    sig = (await db.execute(
        select(Signal).where(Signal.id == signal_id, Signal.user_id == user.id)
    )).scalar_one_or_none()
    if not sig:
        raise HTTPException(status_code=404, detail="Signal not found")
    from sqlalchemy import update
    await db.execute(
        update(SignalAlert)
        .where(SignalAlert.signal_id == signal_id, SignalAlert.is_read == False)
        .values(is_read=True)
    )
