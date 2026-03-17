"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type Post } from "@/lib/api";
import { PostCard } from "@/components/PostCard";

export default function FeedPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPosts = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    api.posts
      .list({ limit: 50 })
      .then(setPosts)
      .catch((e) => !silent && setError(e.message))
      .finally(() => { if (!silent) setLoading(false); });
  }, []);

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
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Лента</h1>
        <p className="text-sm text-[var(--muted)]">Публикации из подключённых источников. Обновляется автоматически.</p>
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
              <PostCard post={post} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
