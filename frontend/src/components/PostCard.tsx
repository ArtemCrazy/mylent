"use client";

import Link from "next/link";
import type { Post } from "@/lib/api";

function formatDate(s: string) {
  const d = new Date(s);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000) return d.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });
  if (diff < 604800000) return d.toLocaleDateString("ru", { weekday: "short", day: "numeric", month: "short" });
  return d.toLocaleDateString("ru", { day: "numeric", month: "short", year: "numeric" });
}

export function PostCard({ post }: { post: Post }) {
  const hasTitle = Boolean(post.title?.trim());
  const bodyText = post.ai_analysis?.summary || post.preview_text || post.raw_text || "";
  const preview = bodyText.slice(0, 300) + (bodyText.length > 300 ? "…" : "");
  const tags = post.ai_analysis?.tags_json ? (JSON.parse(post.ai_analysis.tags_json) as string[]) : [];

  return (
    <article className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 hover:bg-[var(--card-hover)] transition-colors">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-[var(--muted)]">{formatDate(post.published_at)}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {post.is_favorite && (
            <span className="text-amber-500" title="В избранном">★</span>
          )}
          {post.ai_analysis?.business_relevance_score != null && post.ai_analysis.business_relevance_score >= 60 && (
            <span className="text-[var(--accent)] text-xs" title="Полезно для студии">◆</span>
          )}
        </div>
      </div>
      <Link href={`/post/${post.id}`} className="block">
        {hasTitle ? (
          <>
            <h3 className="font-medium text-[var(--foreground)] line-clamp-2 hover:text-[var(--accent)] mb-1">
              {post.title}
            </h3>
            {preview && <p className="text-sm text-[var(--foreground)] line-clamp-3">{preview}</p>}
          </>
        ) : (
          <p className="text-sm text-[var(--foreground)] line-clamp-4 hover:text-[var(--accent)] whitespace-pre-wrap">
            {preview}
          </p>
        )}
      </Link>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.slice(0, 5).map((t) => (
            <span
              key={t}
              className="text-xs px-2 py-0.5 rounded-full bg-[var(--card-hover)] text-[var(--muted)]"
            >
              {t}
            </span>
          ))}
        </div>
      )}
      <div className="mt-3 flex items-center gap-2 text-xs">
        <Link
          href={`/post/${post.id}`}
          className="text-[var(--accent)] hover:underline"
        >
          Открыть
        </Link>
        {post.original_url && (
          <a
            href={post.original_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--muted)] hover:underline"
          >
            Оригинал
          </a>
        )}
      </div>
    </article>
  );
}
