"use client";

import { useState } from "react";
import Link from "next/link";
import type { Post } from "@/lib/api";

const COLLAPSE_THRESHOLD = 2000;

const CATEGORY_LABELS: Record<string, string> = {
  news: "Новости",
  tech: "Технологии",
  ai: "ИИ",
  web_studio: "Веб-студия",
  sport: "Спорт",
  humor: "Юмор",
  space: "Космос",
  investments: "Инвестиции",
  other: "Прочее",
};

function formatDate(s: string) {
  const d = new Date(s);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000) return d.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });
  if (diff < 604800000) return d.toLocaleDateString("ru", { weekday: "short", day: "numeric", month: "short" });
  return d.toLocaleDateString("ru", { day: "numeric", month: "short", year: "numeric" });
}

function getSourceAvatar(configJson: string | null): string | null {
  if (!configJson) return null;
  try {
    const c = JSON.parse(configJson) as { avatar_base64?: string };
    return c.avatar_base64 || null;
  } catch {
    return null;
  }
}

function getCategoryLabel(cat: string | null): string {
  return (cat && CATEGORY_LABELS[cat]) || CATEGORY_LABELS.other || "Прочее";
}

type MediaItem = { type: "photo" | "video"; url?: string; file_id?: string };

function parseMedia(mediaJson: string | null): MediaItem[] {
  if (!mediaJson) return [];
  try {
    const raw = JSON.parse(mediaJson) as { photos?: { url?: string; file_id?: string }[]; videos?: { url?: string; file_id?: string }[] };
    const out: MediaItem[] = [];
    if (Array.isArray(raw.photos)) raw.photos.forEach((p) => out.push({ type: "photo", url: p.url, file_id: p.file_id }));
    if (Array.isArray(raw.videos)) raw.videos.forEach((v) => out.push({ type: "video", url: v.url, file_id: v.file_id }));
    return out;
  } catch {
    return [];
  }
}

export function PostCard({ post, isNew = false }: { post: Post; isNew?: boolean }) {
  const text = post.raw_text || post.cleaned_text || "";
  const isLong = text.length > COLLAPSE_THRESHOLD;
  const [expanded, setExpanded] = useState(false);
  const displayText = isLong && !expanded ? text.slice(0, COLLAPSE_THRESHOLD) + "…" : text;

  const avatar = post.source ? getSourceAvatar(post.source.config_json) : null;
  const categoryLabel = post.source ? getCategoryLabel(post.source.category) : "";
  const media = parseMedia(post.media_json);

  return (
    <article className={`rounded-xl border bg-[var(--card)] p-4 hover:bg-[var(--card-hover)] transition-colors ${
      isNew
        ? "border-blue-400/60 shadow-[0_0_18px_3px_rgba(96,165,250,0.25)] animate-glow-pulse"
        : "border-[var(--border)]"
    }`}>
      {/* 1. Время */}
      <div className="flex items-center gap-2 mb-2">
        <time className="text-xs text-[var(--muted)]" dateTime={post.published_at}>
          {formatDate(post.published_at)}
        </time>
        {/* 2. Иконка источника */}
        {post.source && (
          <div className="w-6 h-6 rounded-full bg-[var(--card-hover)] overflow-hidden flex items-center justify-center shrink-0 text-[var(--muted)] text-xs">
            {avatar ? (
              <img src={`data:image/jpeg;base64,${avatar}`} alt="" className="w-full h-full object-cover" />
            ) : (
              <span>@</span>
            )}
          </div>
        )}
        {/* 3. Категория */}
        {categoryLabel && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--background)] text-[var(--muted)]">
            {categoryLabel}
          </span>
        )}
        {post.is_favorite && <span className="text-amber-500 ml-auto" title="В избранном">★</span>}
      </div>

      {/* 4. Текст (полный; свёрнут только если > 2000 символов) */}
      <div className="mb-3">
        {post.title?.trim() && (
          <h3 className="font-medium text-[var(--foreground)] mb-1">{post.title}</h3>
        )}
        <p className="text-sm text-[var(--foreground)] whitespace-pre-wrap break-words">
          {displayText}
        </p>
        {isLong && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="text-xs text-[var(--accent)] hover:underline mt-1"
          >
            {expanded ? "Свернуть" : "Развернуть"}
          </button>
        )}
      </div>

      {/* 5. Ссылка на источник */}
      {post.original_url && (
        <p className="mb-3">
          <a
            href={post.original_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[var(--accent)] hover:underline"
          >
            Открыть в источнике →
          </a>
        </p>
      )}

      {/* 6. Фото и видео */}
      {media.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {media.map((m, i) => (
            <div key={i} className="rounded-lg overflow-hidden bg-[var(--background)]">
              {m.type === "photo" && m.url && (
                <a href={m.url} target="_blank" rel="noopener noreferrer">
                  <img src={m.url} alt="" className="max-w-full max-h-64 object-contain" />
                </a>
              )}
              {m.type === "video" && m.url && (
                <video src={m.url} controls className="max-w-full max-h-64" />
              )}
              {m.type === "photo" && !m.url && (
                <a href={post.original_url || "#"} target="_blank" rel="noopener noreferrer" className="w-32 h-32 flex items-center justify-center text-[var(--muted)] text-xs border border-[var(--border)] rounded hover:bg-[var(--card-hover)]">
                  Фото →
                </a>
              )}
              {m.type === "video" && !m.url && (
                <a href={post.original_url || "#"} target="_blank" rel="noopener noreferrer" className="w-32 h-32 flex items-center justify-center text-[var(--muted)] text-xs border border-[var(--border)] rounded hover:bg-[var(--card-hover)]">
                  Видео →
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-[var(--border)] flex items-center gap-2 text-xs">
        <Link href={`/post/${post.id}`} className="text-[var(--accent)] hover:underline">
          Страница поста
        </Link>
      </div>
    </article>
  );
}
