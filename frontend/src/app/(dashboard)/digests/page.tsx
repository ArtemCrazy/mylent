"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type Digest } from "@/lib/api";

function formatDate(s: string) {
  return new Date(s).toLocaleDateString("ru", { day: "numeric", month: "short", year: "numeric" });
}

export default function DigestsPage() {
  const [digests, setDigests] = useState<Digest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.digests.list().then(setDigests).catch((e) => setError(e.message)).finally(() => setLoading(false));
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
        <h1 className="text-2xl font-semibold">Дайджесты</h1>
        <p className="text-sm text-[var(--muted)]">Подборки главного за период</p>
      </header>
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-[var(--card)] animate-pulse" />
          ))}
        </div>
      ) : digests.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 text-center text-[var(--muted)]">
          Дайджестов пока нет. Генерация будет доступна после настройки AI и накопления постов.
        </div>
      ) : (
        <ul className="space-y-3">
          {digests.map((d) => (
            <li key={d.id}>
              <Link
                href={`/digests/${d.id}`}
                className="block rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 hover:bg-[var(--card-hover)] transition-colors"
              >
                <span className="font-medium">{d.title}</span>
                <span className="text-sm text-[var(--muted)] ml-2">
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
