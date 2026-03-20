import json
import logging
import asyncio
import concurrent.futures
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.post import Post
from app.models.source import Source

logger = logging.getLogger(__name__)

model = None
pool = concurrent.futures.ThreadPoolExecutor(max_workers=1)

def get_model():
    global model
    if model is None:
        try:
            from sentence_transformers import SentenceTransformer
            logger.info("Loading SentenceTransformer model 'paraphrase-multilingual-MiniLM-L12-v2'...")
            model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')
            logger.info("SentenceTransformer loaded successfully.")
        except ImportError:
            logger.error("sentence-transformers not installed.")
            return None
    return model

def compute_embedding(text: str) -> list[float]:
    """Вычисляет векторное представление текста синхронно."""
    m = get_model()
    if not m or not text:
        return []
    # sentence-transformers returns a numpy array
    vec = m.encode(text)
    return vec.tolist()

def compute_similarity(vec1: list[float], vec2: list[float]) -> float:
    """Вычисляет косинусное сходство двух векторов."""
    if not vec1 or not vec2 or len(vec1) != len(vec2):
        return 0.0
    dot = sum(a * b for a, b in zip(vec1, vec2))
    norm1 = sum(a * a for a in vec1) ** 0.5
    norm2 = sum(b * b for b in vec2) ** 0.5
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return dot / (norm1 * norm2)

async def detect_and_mark_duplicate(db: AsyncSession, post: Post) -> None:
    """
    Берет новый пост, векторизует его, и сравнивает с 50 последними
    постами из этой же категории. Если находит дубль, проставляет
    duplicate_group_id.
    """
    text = (post.cleaned_text or post.raw_text or "").strip()
    if len(text) < 20:  # Слишком короткие тексты не проверяем
        return

    # 1. Вычисляем вектор в отдельном пуле потоков, чтобы не блокировать event loop
    loop = asyncio.get_running_loop()
    new_emb = await loop.run_in_executor(pool, compute_embedding, text)
    if not new_emb:
        return

    post.embedding_json = json.dumps(new_emb)

    # 2. Ищем последние 50 постов вообще без привязки к категории, 
    # чтобы находить дубли даже между СМИ разной направленности
    if not post.source_id:
        return

    stmt = select(Post).join(Source, Post.source_id == Source.id)
    if post.id:
        stmt = stmt.where(Post.id != post.id)

    stmt = stmt.order_by(Post.published_at.desc()).limit(50)
    
    result = await db.execute(stmt)
    recent_posts = list(result.scalars().all())

    best_sim = 0.0
    best_dup_id = None

    for rp in recent_posts:
        if not rp.embedding_json:
            # Лениво довычисляем векторы старым постам
            rp_text = (rp.cleaned_text or rp.raw_text or "").strip()
            if len(rp_text) >= 20:
                rp_vec = await loop.run_in_executor(pool, compute_embedding, rp_text)
                if rp_vec:
                    rp.embedding_json = json.dumps(rp_vec)
                    db.add(rp)
            else:
                continue

        if not rp.embedding_json:
            continue

        try:
            rp_vec = json.loads(rp.embedding_json)
            sim = compute_similarity(new_emb, rp_vec)
            if sim > best_sim:
                best_sim = sim
                best_dup_id = rp.duplicate_group_id or str(rp.id)
        except Exception:
            pass

    # 3. Если смысл совпадает на 65%+, маркируем как дубль
    if best_sim > 0.65 and best_dup_id:
        post.duplicate_group_id = best_dup_id
        logger.info(f"Post {post.external_id} marked as duplicate of {best_dup_id} (sim: {best_sim:.2f})")
