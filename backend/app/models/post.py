from datetime import datetime
from sqlalchemy import String, Integer, Boolean, DateTime, Text, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class Post(Base):
    __tablename__ = "posts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    source_id: Mapped[int] = mapped_column(ForeignKey("sources.id", ondelete="CASCADE"), nullable=False, index=True)
    external_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)  # id in Telegram / source
    title: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    raw_text: Mapped[str] = mapped_column(Text, nullable=False)
    cleaned_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    preview_text: Mapped[str | None] = mapped_column(String(500), nullable=True)
    original_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    imported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    media_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    language: Mapped[str | None] = mapped_column(String(10), nullable=True)
    duplicate_group_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)

    read_status: Mapped[str] = mapped_column(String(20), default="unread", nullable=False)  # unread, read
    is_favorite: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_hidden: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    source: Mapped["Source"] = relationship("Source", back_populates="posts")
    ai_analysis: Mapped["AIAnalysis | None"] = relationship("AIAnalysis", back_populates="post", uselist=False)
    user_actions: Mapped[list["UserAction"]] = relationship("UserAction", back_populates="post")

    __table_args__ = (
        Index("ix_posts_source_external", "source_id", "external_id", unique=True),
    )
