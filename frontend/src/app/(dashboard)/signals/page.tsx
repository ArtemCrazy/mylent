"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, type Signal, type Source } from "@/lib/api";

export default function SignalsPage() {
  const router = useRouter();
  const [signals, setSignals] = useState<Signal[]>([]);
  const [bondSignals, setBondSignals] = useState<any[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  // Create form state
  const [name, setName] = useState("Инвестиции");
  const [selectedSources, setSelectedSources] = useState<number[]>([]);
  const [assetsText, setAssetsText] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    Promise.all([api.signals.list(), api.sources.list(), api.investments.portfolio()])
      .then(([s, src, p]) => { 
        setSignals(s); 
        setSources(src); 
        setBondSignals((p.signals as any[]) || []); 
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      // Parse assets: each line is "Name | Ticker | keyword1, keyword2"
      const assets = assetsText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const parts = line.split("|").map((s) => s.trim());
          const assetName = parts[0] || line;
          const ticker = parts[1] || undefined;
          const keywords = parts[2] || assetName.toLowerCase();
          return { name: assetName, ticker, keywords };
        });
      const sig = await api.signals.create({
        name: name.trim(),
        type: "investments",
        source_ids: selectedSources,
        assets,
      });
      router.push(`/signals/${sig.id}`);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка");
    }
    setCreating(false);
  }

  function toggleSource(id: number) {
    setSelectedSources((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  if (loading) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold mb-4">Сигналы</h1>
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-[var(--card)] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold">Сигналы</h1>
          <p className="text-sm text-[var(--muted)]">Уведомления при упоминании ваших активов в новостях</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          + Создать сигнал
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 mb-6">
          <h2 className="font-medium mb-3">Новый сигнал</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-[var(--muted)] block mb-1">Название</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
            <div>
              <label className="text-sm text-[var(--muted)] block mb-1">Источники (каналы для мониторинга)</label>
              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                {sources.map((src) => (
                  <button
                    key={src.id}
                    type="button"
                    onClick={() => toggleSource(src.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                      selectedSources.includes(src.id)
                        ? "bg-[var(--accent)] text-white"
                        : "bg-[var(--background)] text-[var(--muted)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    {src.title}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm text-[var(--muted)] block mb-1">
                Активы (по одному на строку: <code className="text-xs">Название | Тикер | ключевые слова</code>)
              </label>
              <textarea
                value={assetsText}
                onChange={(e) => setAssetsText(e.target.value)}
                rows={6}
                placeholder={"Газпром | GAZP | газпром,gazprom,gazp\nСбербанк | SBER | сбербанк,сбер,sber\nЯндекс | YDEX | яндекс,yandex,ydex"}
                className="w-full px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm text-[var(--foreground)] font-mono focus:outline-none focus:border-[var(--accent)] resize-y"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating || !name.trim()}
                className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
              >
                {creating ? "Создаю…" : "Создать"}
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 rounded-lg bg-[var(--background)] text-[var(--muted)] text-sm hover:text-[var(--foreground)]"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Signals list */}
      {signals.length === 0 && bondSignals.length === 0 && !showCreate ? (
        <div className="text-center py-12 text-[var(--muted)]">
          <p className="text-lg mb-2">Нет сигналов</p>
          <p className="text-sm">Создайте сигнал, чтобы получать уведомления при упоминании ваших активов</p>
        </div>
      ) : (
        <div className="space-y-6">
          {signals.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-medium text-[var(--muted)] px-1 mb-2">Текстовые сигналы (Парсер)</h2>
              {signals.map((sig) => (
            <Link
              key={sig.id}
              href={`/signals/${sig.id}`}
              className="flex items-center gap-4 p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--card-hover)] transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center text-lg shrink-0">
                📈
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[var(--foreground)]">{sig.name}</span>
                  {!sig.is_active && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--background)] text-[var(--muted)]">выкл</span>
                  )}
                </div>
                <div className="text-xs text-[var(--muted)] mt-0.5">
                  {sig.assets.length} активов · {sig.sources.length} источников
                </div>
              </div>
              {sig.unread_count > 0 && (
                <span className="px-2.5 py-1 rounded-full bg-red-500 text-white text-xs font-bold shrink-0">
                  {sig.unread_count}
                </span>
              )}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--muted)] shrink-0">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
          ))}
            </div>
          )}

          {bondSignals.length > 0 && (
            <div className="space-y-3 mt-8">
              <div className="flex items-center justify-between px-1 mb-2">
                <h2 className="text-sm font-medium text-[var(--muted)]">Сигналы по облигациям</h2>
                <Link href="/investments/bonds?tab=signals" className="text-xs text-[var(--accent)] hover:underline">
                  Управление
                </Link>
              </div>
              {bondSignals.map((sig: any) => (
                <div
                  key={`bond-${sig.id}`}
                  className="flex items-center gap-4 p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] opacity-90"
                >
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center text-lg shrink-0 text-white">
                    ₽
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[var(--foreground)]">{sig.bond?.shortname}</span>
                      {!sig.is_active && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--background)] text-[var(--muted)]">сработал/выкл</span>
                      )}
                    </div>
                    <div className="text-xs text-[var(--muted)] mt-0.5">
                      {sig.condition_type === "price_less" && `Упадет ниже ${sig.target_value}`}
                      {sig.condition_type === "price_greater" && `Вырастет выше ${sig.target_value}`}
                      {sig.condition_type === "yield_greater" && `Доходность > ${sig.target_value}%`}
                      {sig.condition_type === "price_change_drop_greater" && `Падение > ${sig.target_value}%`}
                      {sig.condition_type === "news_mention" && `Упоминание в новостях (Категория: ${sig.news_category || "investments"})`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
