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
from app.core.config import get_settings

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
                    
                price = market_data[0][price_idx] if price_idx != -1 else None
                yld = market_data[0][yield_idx] if yield_idx != -1 else None
                return float(price) if price else None, float(yld) if yld else None
    except Exception as e:
        logger.error(f"Error fetching data for secid {secid}: {e}")
    return None, None

async def check_signals():
    async with AsyncSessionLocal() as db:
        # Get all active signals
        stmt_sig = select(BondSignal, Bond).join(Bond).where(BondSignal.is_active == True)
        res_sig = await db.execute(stmt_sig)
        signals = res_sig.all()
        
        # Get all portfolio bonds
        from app.models.bond import PortfolioBond
        stmt_port = select(Bond).join(PortfolioBond)
        res_port = await db.execute(stmt_port)
        portfolio_bonds = res_port.scalars().all()
        
        # Prepare unique secids to query (both portfolio bonds and signal bonds)
        secids = set(b.secid for b in portfolio_bonds if b.secid)
        secids.update(b.secid for _, b in signals if b.secid)
        
        if not secids:
            logger.info("No active bonds to track.")
            return
            
        logger.info(f"Checking prices for {len(secids)} bonds...")
        
        async with httpx.AsyncClient() as client:
            prices_updates = {}
            for secid in secids:
                price, yld = await fetch_bond_data(client, secid)
                prices_updates[secid] = {"price": price, "yield": yld}
                
                # Update Bond DB record
                b_stmt = select(Bond).where(Bond.secid == secid)
                b_res = await db.execute(b_stmt)
                for b in b_res.scalars().all():
                    if price is not None:
                        b.current_price = price
                    if yld is not None:
                        b.current_yield = yld
                        
            # Check conditions
            for sig, b in signals:
                updates = prices_updates.get(b.secid, {})
                c_price = updates.get("price")
                c_yield = updates.get("yield")
                
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
                    
                if triggered:
                    logger.info(f"Signal triggered [{sig.id}]: {b.shortname} condition {sig.condition_type} {sig.target_value} (Current: {val})")
                    # In MyLent context, we'll deactivate it and log.
                    # Later, this could be tied into the Feed or WebSocket Notifications.
                    sig.is_active = False

            await db.commit()

async def main():
    while True:
        logger.info("Checking bond signals...")
        await check_signals()
        logger.info("Sleeping for 15 minutes...")
        await asyncio.sleep(60 * 15)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Exiting bond signals loop...")
