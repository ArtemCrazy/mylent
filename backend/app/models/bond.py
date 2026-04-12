from datetime import datetime
from sqlalchemy import String, Integer, Boolean, DateTime, Float, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

class Bond(Base):
    __tablename__ = "bonds"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    secid: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    isin: Mapped[str] = mapped_column(String(50), nullable=False, unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    shortname: Mapped[str] = mapped_column(String(255), nullable=False)
    current_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    current_yield: Mapped[float | None] = mapped_column(Float, nullable=True)
    rating_ru: Mapped[str | None] = mapped_column(String(20), nullable=True)
    is_traded: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

class PortfolioBond(Base):
    __tablename__ = "portfolio_bonds"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    bond_id: Mapped[int] = mapped_column(ForeignKey("bonds.id", ondelete="CASCADE"), nullable=False, index=True)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    average_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    bond: Mapped["Bond"] = relationship("Bond")

class BondSignal(Base):
    __tablename__ = "bond_signals"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    bond_id: Mapped[int] = mapped_column(ForeignKey("bonds.id", ondelete="CASCADE"), nullable=False, index=True)
    condition_type: Mapped[str] = mapped_column(String(50), nullable=False)  # price_less, price_greater, yield_greater, news_mention, etc.
    target_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    news_category: Mapped[str | None] = mapped_column(String(100), default="investments", nullable=True)
    cron_minutes: Mapped[int] = mapped_column(Integer, default=15, nullable=False)
    last_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notify_telegram: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    bond: Mapped["Bond"] = relationship("Bond")
