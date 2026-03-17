from datetime import datetime
from fastapi import APIRouter, HTTPException, status, Query
from sqlalchemy import select, and_, or_, desc, asc
from sqlalchemy.orm import selectinload

from app.schemas.post import PostResponse, PostDetailResponse, PostUpdate, AIAnalysisResponse, PostSourceRef
from app.api.deps import CurrentUser, DbSession
from app.models.post import Post
from app.models.source import Source
from app.models.ai_analysis import AIAnalysis

router = APIRouter(prefix="/posts", tags=["posts"])


def _post_to_response(post: Post) -> dict:
    data = {
        "id": post.id,
        "source_id": post.source_id,
        "external_id": post.external_id,
        "title": post.title,
        "raw_text": post.raw_text,
        "cleaned_text": post.cleaned_text,
        "preview_text": post.preview_text,
        "original_url": post.original_url,
        "published_at": post.published_at,
        "imported_at": post.imported_at,
        "updated_at": post.updated_at,
        "media_json": post.media_json,
        "language": post.language,
        "read_status": post.read_status,
        "is_favorite": post.is_favorite,
        "is_hidden": post.is_hidden,
        "is_archived": post.is_archived,
    }
    if post.ai_analysis:
        data["ai_analysis"] = AIAnalysisResponse(
            id=post.ai_analysis.id,
            summary=post.ai_analysis.summary,
            main_topic=post.ai_analysis.main_topic,
            tags_json=post.ai_analysis.tags_json,
            importance_score=post.ai_analysis.importance_score,
            business_relevance_score=post.ai_analysis.business_relevance_score,
            reason_for_relevance=post.ai_analysis.reason_for_relevance,
            digest_candidate=post.ai_analysis.digest_candidate,
            processed_at=post.ai_analysis.processed_at,
        )
    else:
        data["ai_analysis"] = None
    if getattr(post, "source", None):
        data["source"] = PostSourceRef(
            id=post.source.id,
            title=post.source.title,
            category=post.source.category,
            config_json=post.source.config_json,
        )
    else:
        data["source"] = None
    return data


@router.get("", response_model=list[PostResponse])
async def list_posts(
    db: DbSession,
    current_user: CurrentUser,
    source_id: int | None = None,
    category: str | None = None,
    topic: str | None = None,
    only_favorites: bool = False,
    only_unread: bool = False,
    only_for_studio: bool = False,
    only_with_summary: bool = False,
    sort: str = "published_at",
    order: str = "desc",
    limit: int = Query(50, le=100),
    offset: int = 0,
):
    q = select(Post).options(selectinload(Post.source), selectinload(Post.ai_analysis))
    q = q.join(Source, Post.source_id == Source.id)
    q = q.where(Post.is_hidden == False)
    q = q.where(Source.show_in_feed == True)
    if source_id is not None:
        q = q.where(Post.source_id == source_id)
    if category is not None and category.strip():
        q = q.where(Source.category == category.strip())
    if only_favorites:
        q = q.where(Post.is_favorite == True)
    if only_unread:
        q = q.where(Post.read_status == "unread")
    if only_with_summary or only_for_studio or topic:
        q = q.join(AIAnalysis, Post.id == AIAnalysis.post_id)
        if only_with_summary:
            q = q.where(AIAnalysis.summary.isnot(None))
        if only_for_studio:
            q = q.where(AIAnalysis.business_relevance_score >= 60)
        if topic:
            q = q.where(AIAnalysis.main_topic == topic)
    order_col = getattr(Post, sort, Post.published_at)
    q = q.order_by(desc(order_col) if order == "desc" else asc(order_col))
    q = q.offset(offset).limit(limit)
    result = await db.execute(q)
    posts = result.unique().scalars().all()
    return [PostResponse(**_post_to_response(p)) for p in posts]


@router.get("/{post_id}", response_model=PostDetailResponse)
async def get_post(post_id: int, db: DbSession, current_user: CurrentUser):
    result = await db.execute(
        select(Post).options(selectinload(Post.source), selectinload(Post.ai_analysis)).where(Post.id == post_id)
    )
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return PostDetailResponse(**_post_to_response(post))


@router.patch("/{post_id}", response_model=PostResponse)
async def update_post(post_id: int, body: PostUpdate, db: DbSession, current_user: CurrentUser):
    result = await db.execute(select(Post).options(selectinload(Post.ai_analysis)).where(Post.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(post, k, v)
    await db.flush()
    await db.refresh(post)
    return PostResponse(**_post_to_response(post))


@router.post("/{post_id}/favorite", response_model=PostResponse)
async def toggle_favorite(post_id: int, db: DbSession, current_user: CurrentUser):
    result = await db.execute(select(Post).options(selectinload(Post.ai_analysis)).where(Post.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    post.is_favorite = not post.is_favorite
    await db.flush()
    await db.refresh(post)
    return PostResponse(**_post_to_response(post))


@router.post("/{post_id}/hide", response_model=PostResponse)
async def hide_post(post_id: int, db: DbSession, current_user: CurrentUser):
    result = await db.execute(select(Post).options(selectinload(Post.ai_analysis)).where(Post.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    post.is_hidden = True
    await db.flush()
    await db.refresh(post)
    return PostResponse(**_post_to_response(post))


@router.post("/{post_id}/archive", response_model=PostResponse)
async def archive_post(post_id: int, db: DbSession, current_user: CurrentUser):
    result = await db.execute(select(Post).options(selectinload(Post.ai_analysis)).where(Post.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    post.is_archived = True
    await db.flush()
    await db.refresh(post)
    return PostResponse(**_post_to_response(post))


@router.post("/{post_id}/read", response_model=PostResponse)
async def mark_read(post_id: int, db: DbSession, current_user: CurrentUser):
    result = await db.execute(select(Post).options(selectinload(Post.ai_analysis)).where(Post.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    post.read_status = "read"
    await db.flush()
    await db.refresh(post)
    return PostResponse(**_post_to_response(post))
