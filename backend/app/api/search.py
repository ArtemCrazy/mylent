from fastapi import APIRouter, Query
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload

from app.schemas.post import PostResponse, AIAnalysisResponse
from app.api.deps import CurrentUser, DbSession
from app.models.post import Post
from app.models.ai_analysis import AIAnalysis


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
    return data


router = APIRouter(tags=["search"])


@router.get("/search", response_model=list[PostResponse])
async def search_posts(
    db: DbSession,
    current_user: CurrentUser,
    q: str = Query(..., min_length=1),
    source_id: int | None = None,
    limit: int = Query(50, le=100),
    offset: int = 0,
):
    # Simple ILIKE search; later replace with PostgreSQL full-text search
    term = f"%{q}%"
    query = (
        select(Post)
        .options(selectinload(Post.source), selectinload(Post.ai_analysis))
        .where(Post.is_hidden == False)
        .where(
            or_(
                Post.raw_text.ilike(term),
                Post.cleaned_text.ilike(term),
                Post.title.ilike(term),
                Post.preview_text.ilike(term),
            )
        )
    )
    if source_id is not None:
        query = query.where(Post.source_id == source_id)
    query = query.order_by(Post.published_at.desc()).offset(offset).limit(limit)
    result = await db.execute(query)
    posts = result.unique().scalars().all()
    return [PostResponse(**_post_to_response(p)) for p in posts]
