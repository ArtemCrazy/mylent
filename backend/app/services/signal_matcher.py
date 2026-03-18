"""Check new posts against active signals and create alerts."""
from __future__ import annotations

import re
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.signal import Signal, SignalSource, SignalAsset, SignalAlert


async def check_post_signals(db: AsyncSession, post_id: int, source_id: int, text: str) -> int:
    """Check if a new post matches any active signal's keywords.

    Returns number of alerts created.
    """
    if not text:
        return 0

    text_lower = text.lower()

    # Find active signals that monitor this source
    result = await db.execute(
        select(Signal)
        .join(SignalSource)
        .where(
            Signal.is_active == True,
            SignalSource.source_id == source_id,
        )
        .options(selectinload(Signal.assets))
    )
    signals = list(result.scalars().unique().all())
    if not signals:
        return 0

    alerts_created = 0
    for sig in signals:
        for asset in sig.assets:
            keywords = [k.strip().lower() for k in asset.keywords.split(",") if k.strip()]
            for kw in keywords:
                # Word-boundary match to avoid false positives
                pattern = re.compile(r'(?:^|[\s\.,;:!?\-—–()\[\]«»"\'])' + re.escape(kw) + r'(?:[\s\.,;:!?\-—–()\[\]«»"\']|$)', re.IGNORECASE)
                if pattern.search(text_lower):
                    # Check if alert already exists
                    existing = await db.execute(
                        select(SignalAlert).where(
                            SignalAlert.signal_id == sig.id,
                            SignalAlert.post_id == post_id,
                            SignalAlert.asset_id == asset.id,
                        )
                    )
                    if existing.scalar_one_or_none():
                        break  # already alerted for this asset+post
                    alert = SignalAlert(
                        signal_id=sig.id,
                        post_id=post_id,
                        asset_id=asset.id,
                        matched_keyword=kw,
                    )
                    db.add(alert)
                    alerts_created += 1
                    print(f"    🔔 Сигнал: «{asset.name}» найден в посте #{post_id} (ключевое слово: {kw})")
                    break  # one alert per asset per post

    return alerts_created
