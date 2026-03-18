"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, type Digest } from "@/lib/api";

function formatDate(s: string) {
  return new Date(s).toLocaleDateString("ru", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function DigestsPage() {
  const router = useRouter();
  const [digests, setDigests] = useState<Digest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const loadDigests = () => {
    api.digests.list().then(setDigests).catch((e) => setError(e.message)).finally(() => setLoading(false));
  };

  useEffect(() => { loadDigests(); }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    setGenError(null);
    try {
      const digest = await api.digests.generate({ type: "daily" });
      router.push(`/digests/${digest.id}`);
    } catch (e: unknown) {
      setGenError(e instanceof Error ? e.message : "Ошибка генерации");
    } finally {
      setGenerating(false);
    }
  };

  if (error) {
    return (
      <div className="p-8">
        <p className="text-red-400">Ошибка: {error}</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Дайджесты</h1>
          <p className="text-sm text-[var(--muted)]">AI-сводки новостей из ваших каналов</p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {generating ? "Генерация…" : "Создать дайджест"}
        </button>
      </header>

      {genError && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          {genError}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-[var(--card)] animate-pulse" />
          ))}
        </div>
      ) : digests.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 text-center text-[var(--muted)]">
          <p className="mb-2">Дайджестов пока нет.</p>
          <p className="text-sm">Нажмите «Создать дайджест», чтобы AI проанализировал последние новости.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {digests.map((d) => (
            <li key={d.id}>
              <Link
                href={`/digests/${d.id}`}
                className="block rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 hover:bg-[var(--card-hover)] transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{d.title}</span>
                  <span className="text-xs text-[var(--muted)] shrink-0 ml-2">
                    {formatDate(d.created_at)}
                  </span>
                </div>
                {d.summary && (
                  <p className="text-sm text-[var(--muted)] mt-2 line-clamp-2">
                    {d.summary.slice(0, 200)}
                  </p>
                )}
                <span className="text-xs text-[var(--muted)] mt-1 block">
                  {formatDate(d.period_start)} — {formatDate(d.period_end)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
