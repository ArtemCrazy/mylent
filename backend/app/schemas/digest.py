from datetime import datetime
from pydantic import BaseModel
from typing import Optional


class DigestItem(BaseModel):
    post_id: int
    title: Optional[str] = None
    summary: Optional[str] = None
    source_title: Optional[str] = None
    published_at: Optional[datetime] = None


class DigestResponse(BaseModel):
    id: int
    config_id: Optional[int] = None
    config_name: Optional[str] = None
    type: str
    title: str
    period_start: datetime
    period_end: datetime
    summary: Optional[str] = None
    items_json: str
    created_at: datetime

    class Config:
        from_attributes = True


class DigestGenerateRequest(BaseModel):
    type: str  # daily, weekly, for_studio, ai_news, ...
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None


# --- Digest Config schemas ---

class DigestConfigSourceRef(BaseModel):
    id: int
    title: str
    category: Optional[str] = None

    class Config:
        from_attributes = True


class DigestConfigCreate(BaseModel):
    name: str
    prompt: str
    schedule_type: str = "manual"
    schedule_hours: Optional[str] = None
    period_hours: int = 24
    source_ids: list[int] = []


class DigestConfigUpdate(BaseModel):
    name: Optional[str] = None
    prompt: Optional[str] = None
    schedule_type: Optional[str] = None
    schedule_hours: Optional[str] = None
    period_hours: Optional[int] = None
    is_active: Optional[bool] = None
    source_ids: Optional[list[int]] = None


class DigestConfigResponse(BaseModel):
    id: int
    name: str
    prompt: str
    schedule_type: str
    schedule_hours: Optional[str] = None
    period_hours: int
    is_active: bool
    created_at: datetime
    sources: list[DigestConfigSourceRef] = []
    last_digest: Optional[DigestResponse] = None
    digest_count: int = 0

    class Config:
        from_attributes = True
