from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel


class SignalAssetCreate(BaseModel):
    name: str
    ticker: str | None = None
    keywords: str  # comma-separated


class SignalAssetResponse(BaseModel):
    id: int
    name: str
    ticker: str | None
    keywords: str

    class Config:
        from_attributes = True


class SignalCreate(BaseModel):
    name: str
    type: str = "investments"
    source_ids: list[int] = []
    assets: list[SignalAssetCreate] = []


class SignalUpdate(BaseModel):
    name: str | None = None
    is_active: bool | None = None
    source_ids: list[int] | None = None


class SignalSourceRef(BaseModel):
    id: int
    title: str
    category: str | None

    class Config:
        from_attributes = True


class SignalResponse(BaseModel):
    id: int
    name: str
    type: str
    is_active: bool
    created_at: datetime
    sources: list[SignalSourceRef] = []
    assets: list[SignalAssetResponse] = []
    unread_count: int = 0

    class Config:
        from_attributes = True


class SignalAlertPostRef(BaseModel):
    id: int
    title: str | None
    preview_text: str | None
    original_url: str | None
    published_at: datetime
    source_title: str | None = None

    class Config:
        from_attributes = True


class SignalAlertResponse(BaseModel):
    id: int
    signal_id: int
    matched_keyword: str
    is_read: bool
    created_at: datetime
    asset: SignalAssetResponse
    post: SignalAlertPostRef

    class Config:
        from_attributes = True
