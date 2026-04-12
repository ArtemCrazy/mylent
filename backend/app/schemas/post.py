from datetime import datetime
from pydantic import BaseModel
from typing import Optional, List, Any


class AIAnalysisResponse(BaseModel):
    id: int
    summary: Optional[str] = None
    main_topic: Optional[str] = None
    tags_json: Optional[str] = None
    importance_score: Optional[int] = None
    business_relevance_score: Optional[int] = None
    reason_for_relevance: Optional[str] = None
    digest_candidate: bool = False
    processed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PostSourceRef(BaseModel):
    """Минимум данных об источнике для отображения в карточке поста."""
    id: int
    title: str
    type: str
    category: Optional[str] = None
    config_json: Optional[str] = None

    class Config:
        from_attributes = True


class PostBase(BaseModel):
    pass


class PostResponse(PostBase):
    id: int
    source_id: int
    external_id: str
    title: Optional[str] = None
    raw_text: str
    cleaned_text: Optional[str] = None
    preview_text: Optional[str] = None
    original_url: Optional[str] = None
    published_at: datetime
    imported_at: datetime
    updated_at: datetime
    media_json: Optional[str] = None
    language: Optional[str] = None
    read_status: str = "unread"
    is_favorite: bool = False
    is_hidden: bool = False
    is_archived: bool = False
    ai_analysis: Optional[AIAnalysisResponse] = None
    source: Optional[PostSourceRef] = None

    class Config:
        from_attributes = True


class PostDetailResponse(PostResponse):
    pass


class PostUpdate(BaseModel):
    read_status: Optional[str] = None
    is_favorite: Optional[bool] = None
    is_hidden: Optional[bool] = None
    is_archived: Optional[bool] = None


class PostListParams(BaseModel):
    source_id: Optional[int] = None
    topic: Optional[str] = None
    tags: Optional[List[str]] = None
    only_favorites: bool = False
    only_unread: bool = False
    only_for_studio: bool = False
    only_with_summary: bool = False
    period_from: Optional[datetime] = None
    period_to: Optional[datetime] = None
    sort: str = "published_at"
    order: str = "desc"
    limit: int = 50
    offset: int = 0
