from datetime import datetime
from pydantic import BaseModel
from typing import Optional, List, Any


class DigestItem(BaseModel):
    post_id: int
    title: Optional[str] = None
    summary: Optional[str] = None
    source_title: Optional[str] = None
    published_at: Optional[datetime] = None


class DigestResponse(BaseModel):
    id: int
    type: str
    title: str
    period_start: datetime
    period_end: datetime
    summary: Optional[str] = None
    items_json: str  # or parsed list in service
    created_at: datetime

    class Config:
        from_attributes = True


class DigestGenerateRequest(BaseModel):
    type: str  # daily, weekly, for_studio, ai_news, ...
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None
