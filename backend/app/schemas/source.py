from datetime import datetime
from pydantic import BaseModel, HttpUrl
from typing import Optional


class SourceBase(BaseModel):
    type: str
    title: str
    slug: str
    category: Optional[str] = "other"  # news, tech, web_studio, other
    url: Optional[str] = None
    is_active: bool = True
    show_in_feed: bool = True
    priority: int = 0
    config_json: Optional[str] = None


class SourceCreate(SourceBase):
    pass


class SourceUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    url: Optional[str] = None
    is_active: Optional[bool] = None
    show_in_feed: Optional[bool] = None
    priority: Optional[int] = None
    config_json: Optional[str] = None


class SourceResponse(SourceBase):
    id: int
    last_synced_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
