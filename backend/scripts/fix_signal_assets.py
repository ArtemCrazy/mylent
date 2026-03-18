"""
One-time script: extract unique emitters from raw bond data in signal assets,
delete all junk, and recreate proper assets with keywords.

Run: python -m scripts.fix_signal_assets
"""
from __future__ import annotations

import asyncio
import re
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select, delete
from app.core.database import AsyncSessionLocal
from app.models.signal import Signal, SignalAsset


def extract_emitter(bond_name: str) -> str | None:
    """Extract emitter name from bond name like 'АПРИ серия БО-002P-02'."""
    m = re.match(r'^(.+?)\s+(?:серия|выпуск)\s', bond_name, re.IGNORECASE)
    if m:
        return m.group(1).strip()
    return None


def make_keywords(emitter: str) -> str:
    """Generate search keywords from emitter name."""
    keywords = set()
    name = emitter.strip()
    keywords.add(name.lower())

    # Short name without common suffixes
    for suffix in [' ООО', ' ОАО', ' ПАО', ' АО', ' ПКО', ' МФК', ' МК', ' Прав']:
        if name.endswith(suffix):
            short = name[:-len(suffix)].strip()
            keywords.add(short.lower())

    # First word (if multi-word) — often enough for matching
    words = name.split()
    if len(words) > 1 and len(words[0]) >= 4:
        keywords.add(words[0].lower())

    return ','.join(sorted(keywords))


async def main() -> None:
    signal_id = int(sys.argv[1]) if len(sys.argv) > 1 else 1

    async with AsyncSessionLocal() as db:
        # Verify signal exists
        sig = (await db.execute(select(Signal).where(Signal.id == signal_id))).scalar_one_or_none()
        if not sig:
            print(f"Signal {signal_id} not found")
            return

        # Get all current assets
        result = await db.execute(
            select(SignalAsset).where(SignalAsset.signal_id == signal_id).order_by(SignalAsset.id)
        )
        assets = list(result.scalars().all())
        print(f"Current assets: {len(assets)}")

        # Extract bond names and ISINs
        bond_names = []
        isin_map: dict[str, str] = {}  # bond_name -> ISIN

        i = 0
        while i < len(assets):
            name = assets[i].name.strip()

            # Bond name pattern: Cyrillic text + "серия"/"выпуск"
            if extract_emitter(name):
                bond_names.append(name)
                # Next asset might be ISIN
                if i + 1 < len(assets):
                    next_name = assets[i + 1].name.strip()
                    if re.match(r'^RU[0-9A-Za-z]{10,}$', next_name):
                        isin_map[name] = next_name
            i += 1

        # Build unique emitters
        emitters: dict[str, dict] = {}  # emitter -> {bonds: [], isins: []}
        for bn in bond_names:
            emitter = extract_emitter(bn)
            if not emitter:
                continue
            if emitter not in emitters:
                emitters[emitter] = {'bonds': [], 'isins': []}
            emitters[emitter]['bonds'].append(bn)
            if bn in isin_map:
                emitters[emitter]['isins'].append(isin_map[bn])

        print(f"Found {len(bond_names)} bonds -> {len(emitters)} unique emitters\n")

        # Delete all old assets
        await db.execute(delete(SignalAsset).where(SignalAsset.signal_id == signal_id))
        print("Deleted old assets.")

        # Create new proper assets
        created = 0
        for emitter_name in sorted(emitters.keys()):
            info = emitters[emitter_name]
            keywords = make_keywords(emitter_name)

            # Add ISINs to keywords
            for isin in info['isins']:
                keywords += ',' + isin.lower()

            # Ticker = first ISIN if available
            ticker = info['isins'][0] if info['isins'] else None

            asset = SignalAsset(
                signal_id=signal_id,
                name=emitter_name,
                ticker=ticker,
                keywords=keywords,
            )
            db.add(asset)
            created += 1
            bonds_str = f" ({len(info['bonds'])} облигаций)"
            print(f"  + {emitter_name} | {ticker or '-'} | {keywords}{bonds_str}")

        await db.commit()
        print(f"\nDone! Created {created} assets from {len(bond_names)} raw bonds.")


if __name__ == "__main__":
    asyncio.run(main())
