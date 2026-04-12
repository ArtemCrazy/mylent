"use client";

import { useEffect, useState } from "react";
import { api, type Post, getMediaUrl } from "@/lib/api";
import { getCategoryDef } from "@/lib/categories";

const COLLAPSE_THRESHOLD = 2000;

// Категория показывается через общий справочник (чтобы были корректные названия/иконки)

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
  return getCategoryDef(cat)?.label || (cat ? cat : "Другое");
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

/* ── Lightbox ── */
function Lightbox({ src, type, onClose }: { src: string; type: "photo" | "video"; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-xl transition-colors">
        &times;
      </button>
      <div className="max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        {type === "photo" ? (
          <img src={src} alt="" className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg" />
        ) : (
          <video src={src} controls autoPlay className="max-w-[90vw] max-h-[90vh] rounded-lg" />
        )}
      </div>
    </div>
  );
}

export function PostCard({ post, isNew = false, onToggleFavorite, onTitleClick }: { 
  post: Post; 
  isNew?: boolean; 
  onToggleFavorite?: (post: Post) => void;
  onTitleClick?: (url: string) => void;
}) {
  const rawText = post.raw_text || "";
  const htmlText = post.cleaned_text || "";
  const hasHtml = htmlText.includes("<a ") || htmlText.includes("<b>") || htmlText.includes("<i>");
  const isLong = rawText.length > COLLAPSE_THRESHOLD;
  const [expanded, setExpanded] = useState(false);
  const [isFav, setIsFav] = useState(post.is_favorite);
  const [toggling, setToggling] = useState(false);
  const [lightbox, setLightbox] = useState<{ src: string; type: "photo" | "video" } | null>(null);
  const displayRaw = isLong && !expanded ? rawText.slice(0, COLLAPSE_THRESHOLD) + "…" : rawText;
  const displayHtml = isLong && !expanded ? htmlText.slice(0, COLLAPSE_THRESHOLD) + "…" : htmlText;

  const avatar = post.source ? getSourceAvatar(post.source.config_json) : null;
  const categoryLabel = post.source ? getCategoryLabel(post.source.category) : "";
  const media = parseMedia(post.media_json);

  const isNonTelegram = post.source?.type !== "telegram";

  async function handleFavorite() {
    if (toggling) return;
    setToggling(true);
    try {
      await api.posts.favorite(post.id);
      setIsFav((f) => !f);
      onToggleFavorite?.(post);
    } catch { /* ignore */ }
    setToggling(false);
  }

  function handleShare() {
    const url = post.original_url || "";
    const preview = (post.preview_text || rawText).slice(0, 200);
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(preview)}`;
    window.open(shareUrl, "_blank", "noopener,noreferrer");
  }

  function handleTitleClick(e: React.MouseEvent) {
    if (isNonTelegram && post.original_url && onTitleClick) {
      e.preventDefault();
      onTitleClick(post.original_url);
    }
  }

  return (
    <>
      {lightbox && <Lightbox src={lightbox.src} type={lightbox.type} onClose={() => setLightbox(null)} />}
      <article className={`rounded-xl border bg-[var(--card)] p-4 hover:bg-[var(--card-hover)] transition-colors ${
        isNew
          ? "border-blue-400/60 shadow-[0_0_18px_3px_rgba(96,165,250,0.25)] animate-glow-pulse"
          : "border-[var(--border)]"
      }`}>
        {/* Header */}
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
          {categoryLabel && (
            <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-[var(--background)] text-[var(--muted)] shrink-0">
              {categoryLabel}
            </span>
          )}
        </div>

        {/* Text */}
        <div className="mb-3">
          {post.title?.trim() && (
            <h3 className={`font-medium text-[var(--foreground)] mb-1 ${isNonTelegram && post.original_url ? "cursor-pointer hover:text-[var(--accent)] transition-colors" : ""}`} onClick={handleTitleClick}>
              {isNonTelegram && post.original_url ? (
                  <a href={post.original_url} target="_blank" rel="noopener noreferrer" onClick={handleTitleClick}>
                      {post.title}
                  </a>
              ) : post.title}
            </h3>
          )}
          {hasHtml ? (
            <div
              className="text-sm text-[var(--foreground)] whitespace-pre-wrap break-words [&_a]:text-[var(--accent)] [&_a]:underline [&_a]:hover:opacity-80"
              dangerouslySetInnerHTML={{ __html: displayHtml }}
            />
          ) : (
            <p className="text-sm text-[var(--foreground)] whitespace-pre-wrap break-words">
              {displayRaw}
            </p>
          )}
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

        {/* Media — click opens lightbox */}
        {media.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {media.map((m, i) => (
              <div key={i} className="rounded-lg overflow-hidden bg-[var(--background)]">
                {m.type === "photo" && m.url && (
                  <button type="button" onClick={() => setLightbox({ src: getMediaUrl(m.url!), type: "photo" })} className="cursor-zoom-in">
                    <img src={getMediaUrl(m.url)} alt="" className="max-w-full max-h-80 rounded-lg object-contain" loading="lazy" />
                  </button>
                )}
                {m.type === "video" && m.url && (
                  <button type="button" onClick={() => setLightbox({ src: getMediaUrl(m.url!), type: "video" })} className="relative cursor-pointer group">
                    <video src={getMediaUrl(m.url)} className="max-w-full max-h-80 rounded-lg" preload="metadata" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg group-hover:bg-black/40 transition-colors">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="white" opacity={0.9}><polygon points="5 3 19 12 5 21 5 3" /></svg>
                    </div>
                  </button>
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

        {/* Action buttons */}
        <div className="flex items-center gap-1 pt-2 border-t border-[var(--border)]">
          {post.original_url && (
            <a
              href={post.original_url}
              target="_blank"
              rel="noopener noreferrer"
              title="Открыть в источнике"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-[var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--background)] transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              Источник
            </a>
          )}
          {post.original_url && (
            <button
              type="button"
              onClick={handleShare}
              title="Поделиться в Telegram"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-[var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--background)] transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
              Поделиться
            </button>
          )}
          <button
            type="button"
            onClick={handleFavorite}
            disabled={toggling}
            title={isFav ? "Убрать из избранного" : "В избранное"}
            className={`ml-auto inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
              isFav
                ? "text-amber-500 hover:bg-amber-500/10"
                : "text-[var(--muted)] hover:text-amber-500 hover:bg-[var(--background)]"
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill={isFav ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            {isFav ? "В избранном" : "Сохранить"}
          </button>
        </div>
      </article>
    </>
  );
}
