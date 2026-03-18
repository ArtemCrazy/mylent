"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, type Post } from "@/lib/api";
import { PostCard } from "@/components/PostCard";

const FEED_CATEGORIES = [
  { value: "", label: "Все" },
  { value: "news", label: "Новости" },
  { value: "tech", label: "Технологии" },
  { value: "ai", label: "ИИ" },
  { value: "web_studio", label: "Веб-студия" },
  { value: "sport", label: "Спорт" },
  { value: "humor", label: "Юмор" },
  { value: "space", label: "Космос" },
  { value: "investments", label: "Инвестиции" },
  { value: "other", label: "Прочее" },
];

const PAGE_SIZE = 50;
const NEW_POST_TTL = 60_000;

export default function FeedPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<string>("");
  const [newPostIds, setNewPostIds] = useState<Set<number>>(new Set());
  const knownIdsRef = useRef<Set<number>>(new Set());
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Load first page or silent refresh (only refreshes first page)
  const loadPosts = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    const params: Record<string, string | number> = { limit: PAGE_SIZE, offset: 0 };
    if (category) params.category = category;
    api.posts
      .list(params)
      .then((fetched) => {
        if (silent && knownIdsRef.current.size > 0) {
          const fresh = fetched.filter((p) => !knownIdsRef.current.has(p.id)).map((p) => p.id);
          if (fresh.length > 0) {
            setNewPostIds((prev) => new Set([...Array.from(prev), ...fresh]));
            setTimeout(() => {
              setNewPostIds((prev) => {
                const next = new Set(prev);
                fresh.forEach((id) => next.delete(id));
                return next;
              });
            }, NEW_POST_TTL);
          }
        }
        fetched.forEach((p) => knownIdsRef.current.add(p.id));
        if (silent) {
          // Merge new posts at the top, keep already loaded older posts
          setPosts((prev) => {
            const existingIds = new Set(prev.map((p) => p.id));
            // Update existing posts (e.g. favorite state) and prepend truly new ones
            const updated = prev.map((p) => {
              const fresh = fetched.find((f) => f.id === p.id);
              return fresh ?? p;
            });
            const brandNew = fetched.filter((f) => !existingIds.has(f.id));
            return [...brandNew, ...updated];
          });
        } else {
          setPosts(fetched);
          setHasMore(fetched.length >= PAGE_SIZE);
        }
      })
      .catch((e) => !silent && setError(e.message))
      .finally(() => { if (!silent) setLoading(false); });
  }, [category]);

  // Load next page
  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const params: Record<string, string | number> = { limit: PAGE_SIZE, offset: posts.length };
    if (category) params.category = category;
    api.posts
      .list(params)
      .then((fetched) => {
        fetched.forEach((p) => knownIdsRef.current.add(p.id));
        setPosts((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const unique = fetched.filter((p) => !existingIds.has(p.id));
          return [...prev, ...unique];
        });
        setHasMore(fetched.length >= PAGE_SIZE);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  }, [loadingMore, hasMore, posts.length, category]);

  // Initial load + reset on category change
  useEffect(() => {
    setPosts([]);
    setHasMore(true);
    knownIdsRef.current.clear();
    loadPosts(false);
  }, [loadPosts]);

  // Auto-refresh every 45s
  useEffect(() => {
    const interval = setInterval(() => loadPosts(true), 45_000);
    return () => clearInterval(interval);
  }, [loadPosts]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore(); },
      { rootMargin: "400px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  if (error) {
    return (
      <div className="p-8">
        <p className="text-red-400">Ошибка: {error}. Проверьте, что вы авторизованы и backend запущен.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold">Лента</h1>
        <p className="text-sm text-[var(--muted)] mb-4">Публикации из подключённых источников. Обновляется автоматически.</p>
        <div className="flex flex-wrap gap-1 border-b border-[var(--border)] pb-2">
          {FEED_CATEGORIES.map((c) => (
            <button
              key={c.value || "all"}
              type="button"
              onClick={() => setCategory(c.value)}
              className={`px-3 py-1.5 rounded-t text-sm font-medium transition-colors ${
                (c.value === "" && !category) || category === c.value
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--card)] text-[var(--muted)] hover:bg-[var(--card-hover)] hover:text-[var(--foreground)]"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </header>
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 rounded-xl bg-[var(--card)] animate-pulse" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 text-center text-[var(--muted)]">
          <p className="mb-2">Пока нет публикаций.</p>
          <p className="text-sm">Добавьте каналы в разделе «Источники» и один раз войдите в Telegram на сервере: <code className="bg-[var(--background)] px-1.5 py-0.5 rounded">docker compose -p mylent exec -it backend python -m scripts.telegram_sync</code>. Парсер подтянет посты автоматически.</p>
        </div>
      ) : (
        <>
          <ul className="space-y-4">
            {posts.map((post) => (
              <li key={post.id}>
                <PostCard
                  post={post}
                  isNew={newPostIds.has(post.id)}
                  onToggleFavorite={(p) => setPosts((prev) => prev.map((x) => x.id === p.id ? { ...x, is_favorite: !x.is_favorite } : x))}
                />
              </li>
            ))}
          </ul>
          {/* Sentinel for infinite scroll */}
          <div ref={sentinelRef} className="h-1" />
          {loadingMore && (
            <div className="flex justify-center py-6">
              <div className="h-8 w-8 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
            </div>
          )}
          {!hasMore && posts.length > PAGE_SIZE && (
            <p className="text-center text-sm text-[var(--muted)] py-6">Все публикации загружены</p>
          )}
        </>
      )}
    </div>
  );
}
