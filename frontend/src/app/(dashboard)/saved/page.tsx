"use client";

import { useEffect, useState } from "react";
import { api, type Post } from "@/lib/api";
import { PostCard } from "@/components/PostCard";

export default function SavedPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.posts.list({ only_favorites: true, limit: 100 }).then(setPosts).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  if (error) {
    return (
      <div className="p-8">
        <p className="text-red-400">Ошибка: {error}</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Сохранённое</h1>
        <p className="text-sm text-[var(--muted)]">Избранные публикации</p>
      </header>
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 rounded-xl bg-[var(--card)] animate-pulse" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 text-center text-[var(--muted)]">
          Нет сохранённых материалов. Отмечайте понравившиеся посты звёздочкой в ленте.
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
