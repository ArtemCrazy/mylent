import httpx
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.bond import Bond, PortfolioBond, BondSignal

router = APIRouter(tags=["investments"])

@router.get("/search")
async def search_bonds(q: str = Query(..., min_length=2)):
    """Search for bonds on MOEX."""
    url = "https://iss.moex.com/iss/securities.json"
    params = {
        "q": q,
        "iss.meta": "off",
        "securities.columns": "secid,name,shortname,isin,is_traded,group"
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, params=params, timeout=10.0)
            response.raise_for_status()
            data = response.json()
            
            securities = data.get("securities", {}).get("data", [])
            # In data: [secid, name, shortname, isin, is_traded, group]
            return {"results": securities}
        except httpx.RequestError as e:
            raise HTTPException(status_code=503, detail=f"Error connecting to MOEX: {str(e)}")

@router.get("/portfolio")
async def get_portfolio(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Get user's bond portfolio with joined bond data."""
    # Fetch portfolio
    stmt = select(PortfolioBond, Bond).join(Bond).where(PortfolioBond.user_id == user.id)
    result = await db.execute(stmt)
    portfolio_rows = result.all()
    
    # Fetch signals
    sig_stmt = select(BondSignal, Bond).join(Bond).where(BondSignal.user_id == user.id, BondSignal.is_active == True)
    sig_result = await db.execute(sig_stmt)
    signals_rows = sig_result.all()
    
    portfolio = []
    for pb, b in portfolio_rows:
        portfolio.append({
            "id": pb.id,
            "quantity": pb.quantity,
            "average_price": pb.average_price,
            "bond": {
                "id": b.id,
                "secid": b.secid,
                "isin": b.isin,
                "name": b.name,
                "shortname": b.shortname,
                "current_price": b.current_price,
                "current_yield": b.current_yield,
                "rating_ru": b.rating_ru
            }
        })
        
    signals = []
    for sig, b in signals_rows:
        signals.append({
            "id": sig.id,
            "condition_type": sig.condition_type,
            "target_value": sig.target_value,
            "news_category": sig.news_category,
            "cron_minutes": sig.cron_minutes,
            "notify_telegram": sig.notify_telegram,
            "is_active": sig.is_active,
            "created_at": sig.created_at,
            "bond": {
                "id": b.id,
                "shortname": b.shortname,
                "isin": b.isin
            }
        })

    return {
        "portfolio": portfolio,
        "signals": signals
    }

@router.post("/portfolio")
async def add_to_portfolio(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Add a bond to portfolio."""
    secid = payload.get("secid")
    isin = payload.get("isin")
    name = payload.get("name")
    shortname = payload.get("shortname")
    quantity = payload.get("quantity", 1)
    
    if not secid or not isin:
        raise HTTPException(status_code=400, detail="secid and isin are required")
        
    # Get or create Bond
    b_stmt = select(Bond).where(Bond.isin == isin)
    b_res = await db.execute(b_stmt)
    bond = b_res.scalars().first()
    
    if not bond:
        bond = Bond(
            secid=secid,
            isin=isin,
            name=name,
            shortname=shortname or name,
        )
        db.add(bond)
        await db.flush()
        
    # Add to portfolio
    pb = PortfolioBond(
        user_id=user.id,
        bond_id=bond.id,
        quantity=quantity,
        average_price=payload.get("average_price")
    )
    db.add(pb)
    await db.commit()
    
    return {"status": "ok", "id": pb.id}

@router.delete("/portfolio/{id}")
async def remove_from_portfolio(
    id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Remove a bond from portfolio."""
    stmt = select(PortfolioBond).where(PortfolioBond.id == id, PortfolioBond.user_id == user.id)
    res = await db.execute(stmt)
    pb = res.scalars().first()
    
    if not pb:
        raise HTTPException(status_code=404, detail="Not found")
        
    await db.delete(pb)
    await db.commit()
    return {"status": "deleted"}

@router.post("/signals")
async def create_signal(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Create a price/yield signal."""
    bond_id = payload.get("bond_id")
    condition_type = payload.get("condition_type")
    target_value = payload.get("target_value")
    news_category = payload.get("news_category", "investments")
    cron_minutes = payload.get("cron_minutes", 15)
    notify_telegram = payload.get("notify_telegram", True)
    
    if not bond_id or not condition_type:
        raise HTTPException(status_code=400, detail="Missing fields")
        
    if target_value is None and condition_type != "news_mention":
        raise HTTPException(status_code=400, detail="Target value required for this condition type")
        
    # Look for existing active signal for the same bond and type to avoid dupes
    stmt = select(BondSignal).where(
        BondSignal.user_id == user.id,
        BondSignal.bond_id == bond_id,
        BondSignal.condition_type == condition_type,
        BondSignal.is_active == True
    )
    res = await db.execute(stmt)
    sig = res.scalars().first()
    
    val = float(target_value) if target_value is not None else None
    
    if sig:
        sig.target_value = val
        sig.news_category = news_category
        sig.cron_minutes = cron_minutes
        sig.notify_telegram = notify_telegram
        sig.is_active = True
    else:
        sig = BondSignal(
            user_id=user.id,
            bond_id=bond_id,
            condition_type=condition_type,
            target_value=val,
            news_category=news_category,
            cron_minutes=cron_minutes,
            notify_telegram=notify_telegram,
            is_active=True
        )
        db.add(sig)
        
    await db.commit()
    return {"status": "ok", "id": sig.id}

@router.post("/signals/bulk")
async def create_signals_bulk(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Create a signal for multiple bonds at once."""
    bond_ids = payload.get("bond_ids", [])
    condition_type = payload.get("condition_type")
    target_value = payload.get("target_value")
    news_category = payload.get("news_category", "investments")
    cron_minutes = payload.get("cron_minutes", 15)
    notify_telegram = payload.get("notify_telegram", True)
    
    if not bond_ids or not condition_type:
        raise HTTPException(status_code=400, detail="Missing fields")
        
    if target_value is None and condition_type != "news_mention":
        raise HTTPException(status_code=400, detail="Target value required for this condition type")
        
    val = float(target_value) if target_value is not None else None
    created = 0
    
    for bond_id in bond_ids:
        # Avoid dupes
        stmt = select(BondSignal).where(
            BondSignal.user_id == user.id,
            BondSignal.bond_id == bond_id,
            BondSignal.condition_type == condition_type,
            BondSignal.is_active == True
        )
        res = await db.execute(stmt)
        sig = res.scalars().first()
        
        if sig:
            sig.target_value = val
            sig.news_category = news_category
            sig.cron_minutes = cron_minutes
            sig.notify_telegram = notify_telegram
            sig.is_active = True
        else:
            sig = BondSignal(
                user_id=user.id,
                bond_id=bond_id,
                condition_type=condition_type,
                target_value=val,
                news_category=news_category,
                cron_minutes=cron_minutes,
                notify_telegram=notify_telegram,
                is_active=True
            )
            db.add(sig)
            created += 1
            
    await db.commit()
    return {"status": "ok", "created": created}

@router.delete("/signals/{id}")
async def remove_signal(
    id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Remove a signal."""
    stmt = select(BondSignal).where(BondSignal.id == id, BondSignal.user_id == user.id)
    res = await db.execute(stmt)
    sig = res.scalars().first()
    
    if not sig:
        raise HTTPException(status_code=404, detail="Not found")
        
    await db.delete(sig)
    await db.commit()
    return {"status": "deleted"}
