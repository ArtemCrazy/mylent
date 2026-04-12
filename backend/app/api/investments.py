import httpx
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.bond import Bond, PortfolioBond, BondSignal, BondSignalAlert
from app.models.post import Post
from app.models.source import Source

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
        
    stmt_unread = select(BondSignalAlert.bond_signal_id, func.count(BondSignalAlert.id)).where(BondSignalAlert.is_read == False).group_by(BondSignalAlert.bond_signal_id)
    unread_res = await db.execute(stmt_unread)
    unread_map = {row[0]: row[1] for row in unread_res.all()}
    
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
            "unread_count": unread_map.get(sig.id, 0),
            "created_at": sig.created_at,
            "bond": {
                "id": b.id,
                "shortname": b.shortname,
                "isin": b.isin,
                "current_price": b.current_price,
                "current_yield": b.current_yield,
                "rating_ru": b.rating_ru
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

@router.get("/signals/{id}/feed")
async def get_bond_signal_feed(
    id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Get chronological feed of alerts (news + price triggers)."""
    # Verify ownership
    stmt_check = select(BondSignal).where(BondSignal.id == id, BondSignal.user_id == user.id)
    sig = (await db.execute(stmt_check)).scalars().first()
    if not sig:
        raise HTTPException(status_code=404, detail="Signal not found")
        
    stmt_alerts = select(BondSignalAlert, Post, Source).outerjoin(Post, BondSignalAlert.post_id == Post.id).outerjoin(Source, Post.source_id == Source.id).where(BondSignalAlert.bond_signal_id == id).order_by(BondSignalAlert.created_at.desc())
    res_alerts = await db.execute(stmt_alerts)
    
    feed = []
    for alert, post, source in res_alerts.all():
        item = {
            "id": alert.id,
            "message": alert.message,
            "is_read": alert.is_read,
            "created_at": alert.created_at,
            "post": None
        }
        if post and source:
            item["post"] = {
                "id": post.id,
                "text": post.raw_text,
                "url": post.url,
                "original_url": post.original_url,
                "source_title": source.title,
                "source_slug": source.slug,
                "created_at": post.created_at,
                "media_files": [{"url": m.url, "type": m.media_type} for m in post.media] if hasattr(post, "media") and post.media else []
            }
        feed.append(item)

    return {
        "signal": {
            "id": sig.id,
            "condition_type": sig.condition_type,
            "target_value": sig.target_value,
            "news_category": sig.news_category,
            "cron_minutes": sig.cron_minutes,
            "notify_telegram": sig.notify_telegram,
            "is_active": sig.is_active,
            "created_at": sig.created_at,
            "bond": {
                "id": sig.bond.id,
                "shortname": sig.bond.shortname,
                "isin": sig.bond.isin,
            }
        },
        "feed": feed
    }

@router.post("/signals/{id}/read")
async def mark_bond_signal_read(
    id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Mark all alerts for this bond signal as read."""
    # Verify ownership
    stmt_check = select(BondSignal).where(BondSignal.id == id, BondSignal.user_id == user.id)
    sig = (await db.execute(stmt_check)).scalars().first()
    if not sig:
        raise HTTPException(status_code=404, detail="Signal not found")
        
    stmt_update = select(BondSignalAlert).where(BondSignalAlert.bond_signal_id == id, BondSignalAlert.is_read == False)
    alerts = (await db.execute(stmt_update)).scalars().all()
    for alert in alerts:
        alert.is_read = True
        
    await db.commit()
    return {"status": "ok"}

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

@router.patch("/signals/{id}")
async def update_signal(
    id: int,
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Update an existing bond signal."""
    stmt = select(BondSignal).where(BondSignal.id == id, BondSignal.user_id == user.id)
    res = await db.execute(stmt)
    sig = res.scalars().first()
    
    if not sig:
        raise HTTPException(status_code=404, detail="Signal not found")
        
    if "condition_type" in payload:
        condition_type = payload["condition_type"]
        target_value = payload.get("target_value")
        if target_value is None and condition_type != "news_mention":
            raise HTTPException(status_code=400, detail="Target value required for this condition type")
        sig.condition_type = condition_type
        sig.target_value = float(target_value) if target_value is not None else None
        
    if "target_value" in payload and "condition_type" not in payload:
        # User only updated value
        if payload["target_value"] is not None:
            sig.target_value = float(payload["target_value"])
        elif sig.condition_type != "news_mention":
            raise HTTPException(status_code=400, detail="Target value required")
            
    if "news_category" in payload:
        sig.news_category = payload["news_category"]
    
    if "cron_minutes" in payload:
        sig.cron_minutes = int(payload["cron_minutes"])
        
    if "notify_telegram" in payload:
        sig.notify_telegram = bool(payload["notify_telegram"])
        
    # User might toggle it visually if we add a switch, otherwise just implicitly true if they edit
    if "is_active" in payload:
        sig.is_active = bool(payload["is_active"])
    else:
        sig.is_active = True # reactivate on edit by default
        
    await db.commit()
    return {"status": "ok"}

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
