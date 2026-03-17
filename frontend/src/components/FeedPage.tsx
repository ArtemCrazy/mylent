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

const NEW_POST_TTL = 60_000; // glow fades after 60s

export default function FeedPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<string>("");
  const [newPostIds, setNewPostIds] = useState<Set<number>>(new Set());
  const knownIdsRef = useRef<Set<number>>(new Set());

  const loadPosts = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    const params: Record<string, string | number> = { limit: 50 };
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
        knownIdsRef.current = new Set(fetched.map((p) => p.id));
        setPosts(fetched);
      })
      .catch((e) => !silent && setError(e.message))
      .finally(() => { if (!silent) setLoading(false); });
  }, [category]);

  useEffect(() => {
    loadPosts(false);
  }, [loadPosts]);

  useEffect(() => {
    const interval = setInterval(() => loadPosts(true), 45_000);
    return () => clearInterval(interval);
  }, [loadPosts]);

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
          <p className="text-sm mb-4">Добавленные каналы сами по себе не подтягивают посты. Нужно запустить импорт из папки backend:</p>
          <code className="block text-left bg-[var(--background)] rounded-lg p-4 text-[var(--foreground)] text-sm">
            .\.venv\Scripts\python.exe -m scripts.telegram_sync
          </code>
          <p className="text-sm mt-4">Лента обновляется автоматически каждые 45 секунд.</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {posts.map((post) => (
            <li key={post.id}>
              <PostCard post={post} isNew={newPostIds.has(post.id)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
