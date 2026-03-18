"use client";

import { useState } from "react";
import { api, type Post, getMediaUrl } from "@/lib/api";

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

export function PostCard({ post, isNew = false, onToggleFavorite }: { post: Post; isNew?: boolean; onToggleFavorite?: (post: Post) => void }) {
  const text = post.raw_text || post.cleaned_text || "";
  const isLong = text.length > COLLAPSE_THRESHOLD;
  const [expanded, setExpanded] = useState(false);
  const [isFav, setIsFav] = useState(post.is_favorite);
  const [toggling, setToggling] = useState(false);
  const displayText = isLong && !expanded ? text.slice(0, COLLAPSE_THRESHOLD) + "…" : text;

  const avatar = post.source ? getSourceAvatar(post.source.config_json) : null;
  const categoryLabel = post.source ? getCategoryLabel(post.source.category) : "";
  const media = parseMedia(post.media_json);

  async function handleFavorite(e: React.MouseEvent) {
    e.stopPropagation();
    if (toggling) return;
    setToggling(true);
    try {
      await api.posts.favorite(post.id);
      setIsFav((f) => !f);
      onToggleFavorite?.(post);
    } catch { /* ignore */ }
    setToggling(false);
  }

  return (
    <article className={`group relative rounded-xl border bg-[var(--card)] p-4 hover:bg-[var(--card-hover)] transition-colors ${
      isNew
        ? "border-blue-400/60 shadow-[0_0_18px_3px_rgba(96,165,250,0.25)] animate-glow-pulse"
        : "border-[var(--border)]"
    }`}>
      {/* Header: avatar + source name + time | category right */}
      <div className="flex items-center gap-2.5 mb-3">
        {post.source && (
          <div className="w-8 h-8 rounded-full bg-[var(--card-hover)] overflow-hidden flex items-center justify-center shrink-0 text-[var(--muted)] text-xs">
            {avatar ? (
              <img src={`data:image/jpeg;base64,${avatar}`} alt="" className="w-full h-full object-cover" />
            ) : (
              <span>@</span>
            )}
          </div>
        )}
        <div className="flex flex-col min-w-0">
          {post.source && (
            <span className="text-sm font-medium text-[var(--foreground)] truncate leading-tight">
              {post.source.title}
            </span>
          )}
          <time className="text-xs text-[var(--muted)] leading-tight" dateTime={post.published_at}>
            {formatDate(post.published_at)}
          </time>
        </div>
        {/* Category — right corner */}
        {categoryLabel && (
          <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-[var(--background)] text-[var(--muted)] shrink-0">
            {categoryLabel}
          </span>
        )}
      </div>

      {/* Text */}
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

      {/* Media */}
      {media.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-1">
          {media.map((m, i) => (
            <div key={i} className="rounded-lg overflow-hidden bg-[var(--background)]">
              {m.type === "photo" && m.url && (
                <a href={getMediaUrl(m.url)} target="_blank" rel="noopener noreferrer">
                  <img src={getMediaUrl(m.url)} alt="" className="max-w-full max-h-80 rounded-lg object-contain" loading="lazy" />
                </a>
              )}
              {m.type === "video" && m.url && (
                <video src={getMediaUrl(m.url)} controls className="max-w-full max-h-80 rounded-lg" />
              )}
              {m.type === "video" && !m.url && (
                <a href={post.original_url || "#"} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-[var(--muted)] border border-[var(--border)] rounded-lg hover:bg-[var(--card-hover)]">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                  Видео в источнике
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Hover actions — right side */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Link to source */}
        {post.original_url && (
          <a
            href={post.original_url}
            target="_blank"
            rel="noopener noreferrer"
            title="Открыть в источнике"
            className="w-8 h-8 rounded-lg bg-[var(--background)] border border-[var(--border)] flex items-center justify-center text-[var(--muted)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        )}
        {/* Favorite toggle */}
        <button
          type="button"
          onClick={handleFavorite}
          disabled={toggling}
          title={isFav ? "Убрать из избранного" : "В избранное"}
          className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors ${
            isFav
              ? "bg-amber-500/15 border-amber-500/40 text-amber-500 hover:bg-amber-500/25"
              : "bg-[var(--background)] border-[var(--border)] text-[var(--muted)] hover:text-amber-500 hover:border-amber-500/40"
          }`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill={isFav ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </button>
      </div>
    </article>
  );
}
