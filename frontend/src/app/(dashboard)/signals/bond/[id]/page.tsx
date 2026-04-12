"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, type BondSignalAlert } from "@/lib/api";

function formatDate(s: string) {
  const d = new Date(s);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000) return d.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });
  if (diff < 604800000) return d.toLocaleDateString("ru", { weekday: "short", day: "numeric", month: "short" });
  return d.toLocaleDateString("ru", { day: "numeric", month: "short", year: "numeric" });
}

export default function BondSignalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const signalId = Number(params.id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [signal, setSignal] = useState<any>(null);
  const [feed, setFeed] = useState<BondSignalAlert[]>([]);
  const [loading, setLoading] = useState(true);

  // Notification polling
  const prevUnread = useRef(0);

  const loadData = useCallback(async () => {
    try {
      const res = await api.investments.getBondSignalFeed(signalId);
      setSignal(res.signal);
      setFeed(res.feed);

      const unreadCount = res.feed.filter(a => !a.is_read).length;

      // Browser notification for new alerts
      if (prevUnread.current > 0 && unreadCount > prevUnread.current) {
        const newCount = unreadCount - prevUnread.current;
        if (Notification.permission === "granted") {
          new Notification(`MyLent: ${newCount} новых финансовых сигналов`, {
            body: `Облигация «${res.signal.bond.shortname}» — обнаружены новые срабатывания`,
            icon: "/favicon.ico",
          });
        }
      }
      prevUnread.current = unreadCount;
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

  async function handleMarkAllRead() {
    try {
      await api.investments.markBondSignalRead(signalId);
      await loadData();
    } catch { /* ignore */ }
  }

  async function handleDelete() {
    if (!confirm("Удалить сигнал?")) return;
    try {
      await api.investments.removeSignal(signalId);
      router.push("/signals");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка");
    }
  }

  async function handleToggleActive() {
    if (!signal) return;
    try {
      await api.investments.updateSignal(signalId, { is_active: !signal.is_active });
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

  const unreadCount = feed.filter(a => !a.is_read).length;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/signals" className="text-[var(--muted)] hover:text-[var(--foreground)]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
          </Link>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center text-lg shrink-0 text-white">
            ₽
          </div>
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              {signal.bond.shortname}
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-xs font-bold shrink-0">
                  {unreadCount}
                </span>
              )}
            </h1>
            <p className="text-xs text-[var(--muted)]">
              {signal.condition_type === "price_less" && `Упадет ниже ${signal.target_value}`}
              {signal.condition_type === "price_greater" && `Вырастет выше ${signal.target_value}`}
              {signal.condition_type === "yield_greater" && `Доходность > ${signal.target_value}%`}
              {signal.condition_type === "yield_less" && `Доходность < ${signal.target_value}%`}
              {signal.condition_type === "price_change_drop_greater" && `Падение > ${signal.target_value}%`}
              {signal.condition_type === "price_change_grow_greater" && `Рост > ${signal.target_value}%`}
              {signal.condition_type === "news_mention" && `Новостной парсер (${signal.news_category || "investments"})`}
              {' '}·{' '}ISIN: {signal.bond.isin}
            </p>
          </div>
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
          <button
            type="button"
            onClick={handleDelete}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors bg-red-500/15 text-red-500 hover:bg-red-500/25"
          >
            Удалить
          </button>
        </div>
      </div>

      {/* Alerts Feed */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-medium text-sm text-[var(--foreground)]">Лента срабатываний</h2>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="text-xs text-[var(--accent)] hover:underline"
            >
              Отметить все как прочитанные
            </button>
          )}
        </div>
        {feed.length === 0 ? (
          <div className="text-center py-12 border border-[var(--border)] border-dashed rounded-xl">
            <p className="text-lg mb-2 text-[var(--foreground)]">Пока нет сигналов</p>
            <p className="text-sm text-[var(--muted)]">Когда сигнал сработает, уведомления появятся здесь</p>
          </div>
        ) : (
          <div className="space-y-3">
            {feed.map((alert) => (
              <div
                key={alert.id}
                className={`p-4 rounded-xl border transition-colors ${
                  alert.is_read
                    ? "border-[var(--border)] bg-[var(--card)]"
                    : "border-blue-500/40 bg-blue-500/5 shadow-[0_0_15px_rgba(59,130,246,0.1)]"
                }`}
              >
                {!alert.post ? (
                  // Price Alert
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center text-blue-500 shrink-0 mt-0.5">
                      ⚡
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--foreground)]">
                        {alert.message}
                      </p>
                      <time className="text-xs text-[var(--muted)] mt-1 block">{formatDate(alert.created_at)}</time>
                    </div>
                  </div>
                ) : (
                  // News Alert (Post)
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-semibold text-[var(--foreground)]">{alert.post.source_title}</span>
                        <span className="text-[var(--muted)]">·</span>
                        <time className="text-[var(--muted)]">{formatDate(alert.post.created_at)}</time>
                      </div>
                      {alert.message && (
                        <span className="text-[10px] uppercase font-bold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded">
                          {alert.message}
                        </span>
                      )}
                    </div>
                    {alert.post.media_files && alert.post.media_files.length > 0 && (
                      <div className={`grid gap-1 mt-2 mb-2 ${
                        alert.post.media_files.length === 1 ? 'grid-cols-1' :
                        alert.post.media_files.length === 2 ? 'grid-cols-2' :
                        'grid-cols-2 lg:grid-cols-3'
                      }`}>
                        {alert.post.media_files.slice(0, 4).map((media, i) => (
                           media.type === 'photo' ? (
                             <div key={i} className="relative aspect-video rounded-lg overflow-hidden bg-black/5">
                               {/* eslint-disable-next-line @next/next/no-img-element */}
                               <img 
                                 src={`/media/${media.url}`} 
                                 alt="Media" 
                                 className="absolute inset-0 w-full h-full object-cover"
                                 loading="lazy"
                               />
                             </div>
                           ) : media.type === 'video' ? (
                             <div key={i} className="relative aspect-video rounded-lg overflow-hidden bg-black/5">
                               <video 
                                 src={`/media/${media.url}`} 
                                 className="absolute inset-0 w-full h-full object-cover"
                                 controls
                               />
                             </div>
                           ) : null
                        ))}
                      </div>
                    )}
                    <p className="text-sm text-[var(--foreground)] leading-relaxed whitespace-pre-wrap">
                      {alert.post.text}
                    </p>
                    {alert.post.original_url && (
                      <a
                        href={alert.post.original_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[var(--accent)] hover:underline mt-1 self-start"
                      >
                        Открыть оригинал →
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
