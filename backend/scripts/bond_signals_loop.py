import asyncio
import httpx
import logging
from sqlalchemy import select

# This allows running the script directly from backend dir
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import AsyncSessionLocal
from app.models.bond import Bond, BondSignal
from app.models.user import User
from app.models.post import Post
from app.models.source import Source
from app.core.config import get_settings
from scripts.bond_ratings_loop import run_sync as sync_bond_ratings
from datetime import datetime, timezone, timedelta
import re
from scripts.bond_ratings_loop import run_sync as sync_bond_ratings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def fetch_bond_data(session: httpx.AsyncClient, secid: str):
    """Fetch current price and yield for SECID from MOEX."""
    url = f"https://iss.moex.com/iss/engines/stock/markets/bonds/securities/{secid}.json"
    params = {"iss.meta": "off", "iss.only": "marketdata,securities"}
    try:
        response = await session.get(url, params=params, timeout=10.0)
        if response.status_code == 200:
            data = response.json()
            market_data = data.get("marketdata", {}).get("data", [])
            if market_data and len(market_data) > 0:
                cols = data["marketdata"]["columns"]
                try:
                    price_idx = cols.index("LCURRENTPRICE")
                except ValueError:
                    try:
                        price_idx = cols.index("LAST")
                    except ValueError:
                        price_idx = -1
                
                try:
                    yield_idx = cols.index("YIELD")
                except ValueError:
                    yield_idx = -1
                    
                try:
                    chg_idx = cols.index("LASTCHANGEPRCNT")
                except ValueError:
                    chg_idx = -1
                    
                price = market_data[0][price_idx] if price_idx != -1 else None
                yld = market_data[0][yield_idx] if yield_idx != -1 else None
                chg = market_data[0][chg_idx] if chg_idx != -1 else None
                return float(price) if price else None, float(yld) if yld else None, float(chg) if chg else None
    except Exception as e:
        logger.error(f"Error fetching data for secid {secid}: {e}")
    return None, None, None

def extract_keywords_from_bond_name(name: str, shortname: str) -> list[str]:
    """Extrapolate base issuer names from formal bond titles for news matching."""
    noise = r'(?i)\b(ооо|пао|ао|зао|пк|гк|хк|мфк|мкк|оао|гк|группа|компания|микрофинансовая|лизинговая|банк|сб|россии|серия|выпуск|бо|р|p|r)\b'
    
    cleaned = re.sub(noise, '', name or '')
    cleaned = re.sub(r'[\"\'«»]', '', cleaned)
    cleaned = re.sub(r'\b\d+[А-Яа-яa-zA-Z-]*\b', '', cleaned)
    cleaned = re.sub(r'[^\w\s]', ' ', cleaned)
    
    words = [w.strip() for w in cleaned.split() if len(w.strip()) > 3 and not (w.strip().isdigit())]
    
    short_cleaned = re.sub(r'[\"\'«»]', '', shortname or '')
    short_cleaned = re.sub(r'\b\d+[А-Яа-яa-zA-Z-]*\b', '', short_cleaned)
    short_words = [w.strip() for w in short_cleaned.split() if len(w.strip()) > 3]
    
    keywords = set()
    if words:
        # Take the first main word
        keywords.add(words[0].lower())
    if short_words:
        keywords.add(short_words[0].lower())
        
    return list(keywords)

async def check_news_mentions(db, signals, since_dt, force_category=None):
    # Fetch recent investment posts
    where_clauses = [Post.imported_at >= since_dt]
    if force_category:
        where_clauses.append(Source.category == force_category)
        
    stmt = select(Post).join(Source).where(*where_clauses)
    res = await db.execute(stmt)
    recent_posts = res.scalars().all()
    
    if not recent_posts:
        return
        
    triggered_signals = []
    text_corpus = " ".join([p.raw_text.lower() for p in recent_posts if p.raw_text])
    
    for sig, b in signals:
        if sig.condition_type == "news_mention":
            keywords = extract_keywords_from_bond_name(b.name, b.shortname)
            if not keywords:
                # Fallback
                keywords = [b.isin.lower()]
                
            # Simple keyword search in any recent post
            for kw in keywords:
                if kw and kw in text_corpus:
                    triggered_signals.append((sig, b, kw))
                    break
                    
    for sig, b, kw in triggered_signals:
        logger.info(f"News Signal triggered [{sig.id}]: {b.shortname} mentioned by keyword '{kw}'")
        sig.is_active = False

async def check_signals():
    async with AsyncSessionLocal() as db:
        now_utc = datetime.now(timezone.utc)
        
        # Get all active signals
        stmt_sig = select(BondSignal, Bond).join(Bond).where(BondSignal.is_active == True)
        res_sig = await db.execute(stmt_sig)
        all_signals = res_sig.all()
        
        signals_to_check = []
        for sig, b in all_signals:
            if not sig.last_checked_at:
                signals_to_check.append((sig, b))
                continue
            
            # Use safe generic check
            elapsed_mins = (now_utc - sig.last_checked_at.replace(tzinfo=timezone.utc)).total_seconds() / 60
            if elapsed_mins >= (sig.cron_minutes or 15):
                signals_to_check.append((sig, b))
                
        if not signals_to_check:
            logger.info("No bonds due for signal check.")
            return

        # Get all portfolio bonds
        from app.models.bond import PortfolioBond
        stmt_port = select(Bond).join(PortfolioBond)
        res_port = await db.execute(stmt_port)
        portfolio_bonds = res_port.scalars().all()
        
        # Prepare unique secids to query (both portfolio bonds and signal bonds)
        secids = set(b.secid for b in portfolio_bonds if b.secid)
        secids.update(b.secid for _, b in signals_to_check if b.secid)
        
        if not secids:
            logger.info("No active bonds to track.")
            return
            
        logger.info(f"Checking {len(signals_to_check)} signals for {len(secids)} bonds...")
        
        async with httpx.AsyncClient() as client:
            prices_updates = {}
            for secid in secids:
                price, yld, chg_prcnt = await fetch_bond_data(client, secid)
                prices_updates[secid] = {"price": price, "yield": yld, "change_prcnt": chg_prcnt}
                
                # Update Bond DB record
                b_stmt = select(Bond).where(Bond.secid == secid)
                b_res = await db.execute(b_stmt)
                for b in b_res.scalars().all():
                    if price is not None:
                        b.current_price = price
                    if yld is not None:
                        b.current_yield = yld
                        
            # Check conditions
            for sig, b in signals_to_check:
                sig.last_checked_at = now_utc
                updates = prices_updates.get(b.secid, {})
                c_price = updates.get("price")
                c_yield = updates.get("yield")
                c_chg = updates.get("change_prcnt")
                
                triggered = False
                val = 0
                
                if sig.condition_type == "price_less" and c_price is not None and c_price <= sig.target_value:
                    triggered = True
                    val = c_price
                elif sig.condition_type == "price_greater" and c_price is not None and c_price >= sig.target_value:
                    triggered = True
                    val = c_price
                elif sig.condition_type == "yield_greater" and c_yield is not None and c_yield >= sig.target_value:
                    triggered = True
                    val = c_yield
                elif sig.condition_type == "yield_less" and c_yield is not None and c_yield <= sig.target_value:
                    triggered = True
                    val = c_yield
                elif sig.condition_type == "price_change_drop_greater" and c_chg is not None and c_chg <= -sig.target_value:
                    triggered = True
                    val = c_chg
                elif sig.condition_type == "price_change_grow_greater" and c_chg is not None and c_chg >= sig.target_value:
                    triggered = True
                    val = c_chg
                    
                if triggered:
                    logger.info(f"Signal triggered [{sig.id}]: {b.shortname} condition {sig.condition_type} {sig.target_value} (Current: {val})")
                    # In MyLent context, we'll deactivate it and log.
                    sig.is_active = False
                    # TODO: If sig.notify_telegram is true, invoke Tg alert

            # Group news constraints by category
            category_map = {}
            for sig, b in signals_to_check:
                c = sig.news_category or "investments"
                if c not in category_map:
                    category_map[c] = []
                category_map[c].append((sig, b))

            for cat, c_signals in category_map.items():
                max_cron = max([s.cron_minutes for s, b in c_signals]) or 15
                since_ago = now_utc - timedelta(minutes=max_cron + 5)
                await check_news_mentions(db, c_signals, since_ago, force_category=cat)

            await db.commit()

async def main():
    loop_count = 0
    while True:
        # Update ratings once per 24 hours (288 loops * 5m = 24h)
        if loop_count % 288 == 0:
            logger.info("Daily rating sync triggered...")
            try:
                await sync_bond_ratings()
            except Exception as e:
                logger.error(f"Error syncing ratings: {e}")

        logger.info("Checking bond signals...")
        await check_signals()
        
        loop_count += 1
        logger.info("Sleeping for 5 minutes...")
        await asyncio.sleep(60 * 5)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Exiting bond signals loop...")
