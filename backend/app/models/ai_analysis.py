from datetime import datetime
from sqlalchemy import String, Integer, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class AIAnalysis(Base):
    __tablename__ = "ai_analyses"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    main_topic: Mapped[str | None] = mapped_column(String(100), nullable=True)
    tags_json: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON array of strings
    importance_score: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 1-100
    business_relevance_score: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 1-100
    reason_for_relevance: Mapped[str | None] = mapped_column(Text, nullable=True)
    digest_candidate: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    model_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    post: Mapped["Post"] = relationship("Post", back_populates="ai_analysis")
