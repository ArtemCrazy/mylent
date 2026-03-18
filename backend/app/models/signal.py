from datetime import datetime
from sqlalchemy import String, Integer, Boolean, DateTime, Text, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class Signal(Base):
    __tablename__ = "signals"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[str] = mapped_column(String(50), nullable=False, default="investments")  # investments, custom, ...
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    sources: Mapped[list["SignalSource"]] = relationship("SignalSource", back_populates="signal", cascade="all, delete-orphan", passive_deletes=True)
    assets: Mapped[list["SignalAsset"]] = relationship("SignalAsset", back_populates="signal", cascade="all, delete-orphan", passive_deletes=True)
    alerts: Mapped[list["SignalAlert"]] = relationship("SignalAlert", back_populates="signal", cascade="all, delete-orphan", passive_deletes=True)


class SignalSource(Base):
    """Which sources (channels) a signal monitors."""
    __tablename__ = "signal_sources"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    signal_id: Mapped[int] = mapped_column(ForeignKey("signals.id", ondelete="CASCADE"), nullable=False, index=True)
    source_id: Mapped[int] = mapped_column(ForeignKey("sources.id", ondelete="CASCADE"), nullable=False, index=True)

    signal: Mapped["Signal"] = relationship("Signal", back_populates="sources")
    source: Mapped["Source"] = relationship("Source")

    __table_args__ = (
        Index("ix_signal_sources_unique", "signal_id", "source_id", unique=True),
    )


class SignalAsset(Base):
    """Securities / emitters to watch for in posts."""
    __tablename__ = "signal_assets"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    signal_id: Mapped[int] = mapped_column(ForeignKey("signals.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)  # e.g. "Газпром"
    ticker: Mapped[str | None] = mapped_column(String(50), nullable=True)  # e.g. "GAZP"
    keywords: Mapped[str] = mapped_column(Text, nullable=False)  # comma-separated search terms, e.g. "газпром,gazprom,GAZP"

    signal: Mapped["Signal"] = relationship("Signal", back_populates="assets")
    alerts: Mapped[list["SignalAlert"]] = relationship("SignalAlert", back_populates="asset", cascade="all, delete-orphan", passive_deletes=True)


class SignalAlert(Base):
    """Triggered alert when a post matches an asset's keywords."""
    __tablename__ = "signal_alerts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    signal_id: Mapped[int] = mapped_column(ForeignKey("signals.id", ondelete="CASCADE"), nullable=False, index=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True)
    asset_id: Mapped[int] = mapped_column(ForeignKey("signal_assets.id", ondelete="CASCADE"), nullable=False, index=True)
    matched_keyword: Mapped[str] = mapped_column(String(255), nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    signal: Mapped["Signal"] = relationship("Signal", back_populates="alerts")
    post: Mapped["Post"] = relationship("Post")
    asset: Mapped["SignalAsset"] = relationship("SignalAsset", back_populates="alerts")

    __table_args__ = (
        Index("ix_signal_alerts_unique", "signal_id", "post_id", "asset_id", unique=True),
    )
