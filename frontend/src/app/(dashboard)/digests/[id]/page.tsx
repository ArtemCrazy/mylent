"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, type Digest } from "@/lib/api";

function formatDate(s: string) {
  return new Date(s).toLocaleString("ru", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function DigestDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const [digest, setDigest] = useState<Digest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  let items: { post_id?: number; title?: string; summary?: string }[] = [];
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
        <div className="rounded-lg bg-[var(--accent-soft)] border border-[var(--border)] p-4 mb-6">
          <p className="text-[var(--foreground)]">{digest.summary}</p>
        </div>
      )}
      {items.length === 0 ? (
        <p className="text-[var(--muted)]">В дайджесте пока нет материалов.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item, i) => (
            <li key={i} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
              {item.post_id ? (
                <Link href={`/post/${item.post_id}`} className="font-medium hover:text-[var(--accent)]">
                  {item.title || `Материал #${item.post_id}`}
                </Link>
              ) : (
                <span className="font-medium">{item.title || "—"}</span>
              )}
              {item.summary && <p className="text-sm text-[var(--muted)] mt-1">{item.summary}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
