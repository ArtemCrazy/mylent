from datetime import datetime
from sqlalchemy import String, DateTime, Text, Date
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class Digest(Base):
    __tablename__ = "digests"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    type: Mapped[str] = mapped_column(String(50), nullable=False)  # daily, weekly, for_studio, ai_news, ...
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    period_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    period_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    items_json: Mapped[str] = mapped_column(Text, nullable=False)  # JSON array of digest items
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
