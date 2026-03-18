"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { api, type Digest } from "@/lib/api";

function formatDate(s: string) {
  return new Date(s).toLocaleString("ru", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DigestDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const [digest, setDigest] = useState<Digest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPosts, setShowPosts] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.digests.get(id).then(setDigest).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [id]);

  if (error || (!loading && !digest)) {
    return (
      <div className="p-8">
        <p className="text-red-400">{error || "Дайджест не найден"}</p>
        <Link href="/digests" className="text-[var(--accent)] mt-2 inline-block">← К списку дайджестов</Link>
      </div>
    );
  }

  if (loading || !digest) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="h-8 w-48 bg-[var(--card)] rounded animate-pulse mb-4" />
        <div className="h-64 bg-[var(--card)] rounded animate-pulse" />
      </div>
    );
  }

  let items: { post_id?: number; title?: string; source_title?: string; published_at?: string }[] = [];
  try {
    items = JSON.parse(digest.items_json);
  } catch {
    // ignore
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link href="/digests" className="text-sm text-[var(--muted)] hover:text-[var(--accent)] mb-4 inline-block">
        ← К списку дайджестов
      </Link>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">{digest.title}</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          {formatDate(digest.period_start)} — {formatDate(digest.period_end)}
        </p>
      </header>

      {digest.summary && (
        <div className="prose prose-invert max-w-none rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 mb-6">
          <ReactMarkdown
            components={{
              h1: ({ children }) => <h2 className="text-xl font-bold mt-4 mb-2 text-[var(--foreground)]">{children}</h2>,
              h2: ({ children }) => <h3 className="text-lg font-semibold mt-4 mb-2 text-[var(--foreground)]">{children}</h3>,
              h3: ({ children }) => <h4 className="text-base font-semibold mt-3 mb-1 text-[var(--foreground)]">{children}</h4>,
              p: ({ children }) => <p className="text-[var(--foreground)] mb-3 leading-relaxed">{children}</p>,
              strong: ({ children }) => <strong className="text-[var(--accent)] font-semibold">{children}</strong>,
              ul: ({ children }) => <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>,
              li: ({ children }) => <li className="text-[var(--foreground)]">{children}</li>,
              a: ({ href, children }) => (
                <a href={href} className="text-[var(--accent)] underline" target="_blank" rel="noopener noreferrer">{children}</a>
              ),
            }}
          >
            {digest.summary}
          </ReactMarkdown>
        </div>
      )}

      {items.length > 0 && (
        <div>
          <button
            onClick={() => setShowPosts(!showPosts)}
            className="text-sm text-[var(--muted)] hover:text-[var(--accent)] mb-3 flex items-center gap-1"
          >
            <span className={`transition-transform ${showPosts ? "rotate-90" : ""}`}>▶</span>
            Исходные посты ({items.length})
          </button>
          {showPosts && (
            <ul className="space-y-2">
              {items.map((item, i) => (
                <li key={i} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 text-sm">
                  <div className="flex items-center justify-between">
                    {item.post_id ? (
                      <Link href={`/post/${item.post_id}`} className="font-medium hover:text-[var(--accent)] truncate">
                        {item.title || `Пост #${item.post_id}`}
                      </Link>
                    ) : (
                      <span className="font-medium truncate">{item.title || "—"}</span>
                    )}
                    {item.source_title && (
                      <span className="text-[var(--muted)] text-xs ml-2 shrink-0">{item.source_title}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
