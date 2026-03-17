"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, type Post } from "@/lib/api";

function formatDate(s: string) {
  return new Date(s).toLocaleString("ru", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PostPage() {
  const params = useParams();
  const id = Number(params.id);
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api.posts
      .get(id)
      .then(setPost)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (error || (!loading && !post)) {
    return (
      <div className="p-8">
        <p className="text-red-400">{error || "Материал не найден"}</p>
        <Link href="/" className="text-[var(--accent)] mt-2 inline-block">← Назад к ленте</Link>
      </div>
    );
  }

  if (loading || !post) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="h-8 w-48 bg-[var(--card)] rounded animate-pulse mb-4" />
        <div className="h-64 bg-[var(--card)] rounded animate-pulse" />
      </div>
    );
  }

  const tags = post.ai_analysis?.tags_json ? (JSON.parse(post.ai_analysis.tags_json) as string[]) : [];

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link href="/" className="text-sm text-[var(--muted)] hover:text-[var(--accent)] mb-4 inline-block">
        ← Назад к ленте
      </Link>
      <header className="mb-4">
        <p className="text-xs text-[var(--muted)]">{formatDate(post.published_at)}</p>
        {post.title?.trim() && (
          <h1 className="text-xl font-semibold mt-1">{post.title}</h1>
        )}
      </header>
      {post.ai_analysis?.summary && (
        <div className="rounded-lg bg-[var(--accent-soft)] border border-[var(--border)] p-4 mb-6">
          <p className="text-sm font-medium text-[var(--accent)] mb-1">Кратко</p>
          <p className="text-[var(--foreground)]">{post.ai_analysis.summary}</p>
        </div>
      )}
      <div className="prose prose-invert max-w-none text-[var(--foreground)] whitespace-pre-wrap break-words">
        {post.cleaned_text || post.raw_text}
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-6">
          {tags.map((t) => (
            <span
              key={t}
              className="text-xs px-2 py-1 rounded-full bg-[var(--card-hover)] text-[var(--muted)]"
            >
              {t}
            </span>
          ))}
        </div>
      )}
      {post.original_url && (
        <a
          href={post.original_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-block text-sm text-[var(--accent)] hover:underline"
        >
          Открыть оригинал →
        </a>
      )}
    </div>
  );
}
