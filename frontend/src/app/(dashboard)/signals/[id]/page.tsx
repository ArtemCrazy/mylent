"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, type Signal, type SignalAlert, type Source } from "@/lib/api";

function formatDate(s: string) {
  const d = new Date(s);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000) return d.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });
  if (diff < 604800000) return d.toLocaleDateString("ru", { weekday: "short", day: "numeric", month: "short" });
  return d.toLocaleDateString("ru", { day: "numeric", month: "short", year: "numeric" });
}

export default function SignalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const signalId = Number(params.id);

  const [signal, setSignal] = useState<Signal | null>(null);
  const [alerts, setAlerts] = useState<SignalAlert[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"alerts" | "assets" | "settings">("alerts");

  // Add asset form
  const [assetName, setAssetName] = useState("");
  const [assetTicker, setAssetTicker] = useState("");
  const [assetKeywords, setAssetKeywords] = useState("");
  const [addingAsset, setAddingAsset] = useState(false);

  // Edit sources
  const [editingSources, setEditingSources] = useState(false);
  const [selectedSources, setSelectedSources] = useState<number[]>([]);

  // Notification polling
  const prevUnread = useRef(0);

  const loadData = useCallback(async () => {
    try {
      const [sig, al, src] = await Promise.all([
        api.signals.get(signalId),
        api.signals.alerts(signalId, { limit: 100 }),
        api.sources.list(),
      ]);
      setSignal(sig);
      setAlerts(al);
      setSources(src);
      setSelectedSources(sig.sources.map((s) => s.id));

      // Browser notification for new alerts
      if (prevUnread.current > 0 && sig.unread_count > prevUnread.current) {
        const newCount = sig.unread_count - prevUnread.current;
        if (Notification.permission === "granted") {
          new Notification(`MyLent: ${newCount} новых сигналов`, {
            body: `Сигнал «${sig.name}» — обнаружены упоминания ваших активов`,
            icon: "/favicon.ico",
          });
        }
      }
      prevUnread.current = sig.unread_count;
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, [signalId]);

  useEffect(() => {
    loadData();
    // Poll every 30s for new alerts
    const interval = setInterval(loadData, 30_000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Request notification permission
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  async function handleAddAsset() {
    if (!assetName.trim() || !assetKeywords.trim()) return;
    setAddingAsset(true);
    try {
      await api.signals.addAsset(signalId, {
        name: assetName.trim(),
        ticker: assetTicker.trim() || undefined,
        keywords: assetKeywords.trim(),
      });
      setAssetName("");
      setAssetTicker("");
      setAssetKeywords("");
      await loadData();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка");
    }
    setAddingAsset(false);
  }

  async function handleDeleteAsset(assetId: number) {
    if (!confirm("Удалить актив?")) return;
    try {
      await api.signals.deleteAsset(signalId, assetId);
      await loadData();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка");
    }
  }

  async function handleSaveSources() {
    try {
      await api.signals.update(signalId, { source_ids: selectedSources });
      setEditingSources(false);
      await loadData();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка");
    }
  }

  async function handleMarkAllRead() {
    try {
      await api.signals.markAllRead(signalId);
      await loadData();
    } catch { /* ignore */ }
  }

  async function handleDelete() {
    if (!confirm("Удалить сигнал?")) return;
    try {
      await api.signals.delete(signalId);
      router.push("/signals");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка");
    }
  }

  async function handleToggleActive() {
    if (!signal) return;
    try {
      await api.signals.update(signalId, { is_active: !signal.is_active });
      await loadData();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка");
    }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="h-8 w-48 bg-[var(--card)] animate-pulse rounded mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-[var(--card)] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!signal) {
    return (
      <div className="p-6 max-w-3xl mx-auto text-center text-[var(--muted)]">
        Сигнал не найден
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <Link href="/signals" className="text-[var(--muted)] hover:text-[var(--foreground)]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
        </Link>
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center text-lg shrink-0">
          📈
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">{signal.name}</h1>
          <p className="text-xs text-[var(--muted)]">
            {signal.assets.length} активов · {signal.sources.length} источников
            {signal.unread_count > 0 && ` · ${signal.unread_count} непрочитанных`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleToggleActive}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              signal.is_active ? "bg-green-500/15 text-green-400" : "bg-[var(--background)] text-[var(--muted)]"
            }`}
          >
            {signal.is_active ? "Активен" : "Выключен"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mt-4 mb-4 border-b border-[var(--border)]">
        {(["alerts", "assets", "settings"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {t === "alerts" && `Сигналы${signal.unread_count > 0 ? ` (${signal.unread_count})` : ""}`}
            {t === "assets" && `Активы (${signal.assets.length})`}
            {t === "settings" && "Настройки"}
          </button>
        ))}
      </div>

      {/* Alerts tab */}
      {tab === "alerts" && (
        <div>
          {signal.unread_count > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="text-xs text-[var(--accent)] hover:underline mb-3"
            >
              Отметить все как прочитанные
            </button>
          )}
          {alerts.length === 0 ? (
            <div className="text-center py-12 text-[var(--muted)]">
              <p className="text-lg mb-2">Пока нет сигналов</p>
              <p className="text-sm">Когда в новостях появится упоминание ваших активов, вы увидите это здесь</p>
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-4 rounded-xl border transition-colors ${
                    alert.is_read
                      ? "border-[var(--border)] bg-[var(--card)]"
                      : "border-amber-500/40 bg-amber-500/5"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-500 shrink-0 mt-0.5">
                      🔔
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-[var(--foreground)]">{alert.asset.name}</span>
                        {alert.asset.ticker && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--background)] text-[var(--muted)]">
                            {alert.asset.ticker}
                          </span>
                        )}
                        <span className="text-xs text-[var(--muted)]">
                          совпадение: «{alert.matched_keyword}»
                        </span>
                      </div>
                      <p className="text-sm text-[var(--foreground)] mt-1 line-clamp-2">
                        {alert.post.preview_text || alert.post.title || "—"}
                      </p>
                      <div className="flex items-center gap-3 mt-2">
                        <time className="text-xs text-[var(--muted)]">{formatDate(alert.created_at)}</time>
                        {alert.post.original_url && (
                          <a
                            href={alert.post.original_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-[var(--accent)] hover:underline"
                          >
                            Открыть в источнике →
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Assets tab */}
      {tab === "assets" && (
        <div>
          {/* Add asset form */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 mb-4">
            <h3 className="text-sm font-medium mb-3">Добавить актив</h3>
            <div className="grid grid-cols-3 gap-2">
              <input
                value={assetName}
                onChange={(e) => setAssetName(e.target.value)}
                placeholder="Название (Газпром)"
                className="px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
              />
              <input
                value={assetTicker}
                onChange={(e) => setAssetTicker(e.target.value)}
                placeholder="Тикер (GAZP)"
                className="px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
              />
              <input
                value={assetKeywords}
                onChange={(e) => setAssetKeywords(e.target.value)}
                placeholder="Ключевые слова через запятую"
                className="px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
            <button
              type="button"
              onClick={handleAddAsset}
              disabled={addingAsset || !assetName.trim() || !assetKeywords.trim()}
              className="mt-2 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {addingAsset ? "Добавляю…" : "Добавить"}
            </button>
          </div>

          {/* Assets list */}
          {signal.assets.length === 0 ? (
            <p className="text-center text-[var(--muted)] py-8">Нет активов. Добавьте бумаги для отслеживания.</p>
          ) : (
            <div className="space-y-2">
              {signal.assets.map((asset) => (
                <div
                  key={asset.id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border)] bg-[var(--card)]"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{asset.name}</span>
                      {asset.ticker && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--background)] text-[var(--muted)]">
                          {asset.ticker}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--muted)] mt-0.5 truncate">
                      Ключевые слова: {asset.keywords}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteAsset(asset.id)}
                    className="text-[var(--muted)] hover:text-red-400 transition-colors shrink-0"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                      <path d="M10 11v6M14 11v6" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Settings tab */}
      {tab === "settings" && (
        <div className="space-y-4">
          {/* Sources */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium">Источники для мониторинга</h3>
              {!editingSources ? (
                <button
                  type="button"
                  onClick={() => setEditingSources(true)}
                  className="text-xs text-[var(--accent)] hover:underline"
                >
                  Изменить
                </button>
              ) : (
                <div className="flex gap-2">
                  <button type="button" onClick={handleSaveSources} className="text-xs text-[var(--accent)] hover:underline">
                    Сохранить
                  </button>
                  <button type="button" onClick={() => { setEditingSources(false); setSelectedSources(signal.sources.map(s => s.id)); }} className="text-xs text-[var(--muted)] hover:underline">
                    Отмена
                  </button>
                </div>
              )}
            </div>
            {editingSources ? (
              <div className="flex flex-wrap gap-2">
                {sources.map((src) => (
                  <button
                    key={src.id}
                    type="button"
                    onClick={() => setSelectedSources((prev) => prev.includes(src.id) ? prev.filter(s => s !== src.id) : [...prev, src.id])}
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
            ) : (
              <div className="flex flex-wrap gap-2">
                {signal.sources.length === 0 ? (
                  <p className="text-xs text-[var(--muted)]">Не выбрано ни одного источника</p>
                ) : (
                  signal.sources.map((src) => (
                    <span key={src.id} className="px-3 py-1.5 rounded-lg text-xs bg-[var(--background)] text-[var(--foreground)]">
                      {src.title}
                    </span>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Danger zone */}
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
            <h3 className="text-sm font-medium text-red-400 mb-2">Опасная зона</h3>
            <button
              type="button"
              onClick={handleDelete}
              className="px-4 py-2 rounded-lg bg-red-500/15 text-red-400 text-sm hover:bg-red-500/25 transition-colors"
            >
              Удалить сигнал
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
