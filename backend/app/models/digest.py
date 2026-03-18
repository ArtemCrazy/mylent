from datetime import datetime
from sqlalchemy import String, Integer, Boolean, DateTime, Text, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class DigestConfig(Base):
    __tablename__ = "digest_configs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    schedule_type: Mapped[str] = mapped_column(String(20), nullable=False, default="manual")  # manual, daily, weekly
    schedule_hours: Mapped[str | None] = mapped_column(String(100), nullable=True)  # comma-separated UTC hours
    period_hours: Mapped[int] = mapped_column(Integer, nullable=False, default=24)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    sources: Mapped[list["DigestConfigSource"]] = relationship(
        "DigestConfigSource", back_populates="config", cascade="all, delete-orphan", passive_deletes=True
    )
    digests: Mapped[list["Digest"]] = relationship(
        "Digest", back_populates="config", cascade="all, delete-orphan", passive_deletes=True
    )


class DigestConfigSource(Base):
    __tablename__ = "digest_config_sources"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    config_id: Mapped[int] = mapped_column(ForeignKey("digest_configs.id", ondelete="CASCADE"), nullable=False, index=True)
    source_id: Mapped[int] = mapped_column(ForeignKey("sources.id", ondelete="CASCADE"), nullable=False, index=True)

    config: Mapped["DigestConfig"] = relationship("DigestConfig", back_populates="sources")
    source: Mapped["Source"] = relationship("Source")

    __table_args__ = (
        Index("ix_digest_config_source_unique", "config_id", "source_id", unique=True),
    )


class Digest(Base):
    __tablename__ = "digests"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    config_id: Mapped[int | None] = mapped_column(ForeignKey("digest_configs.id", ondelete="SET NULL"), nullable=True, index=True)
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    period_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    period_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    items_json: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    config: Mapped["DigestConfig | None"] = relationship("DigestConfig", back_populates="digests")
