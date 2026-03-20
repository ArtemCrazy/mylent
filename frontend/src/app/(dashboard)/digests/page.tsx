"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, type DigestConfig, type Source, type Digest } from "@/lib/api";
import { SourcePicker } from "@/components/SourcePicker";

const DEFAULT_PROMPT = `Ты — AI-редактор новостной ленты. Тебе дан список постов из Telegram-каналов за определённый период.

Твоя задача — составить краткий дайджест на русском языке:
1. Начни с общего резюме (2-3 предложения): что было главным за период.
2. Затем выдели 5-10 ключевых тем/новостей, сгруппировав связанные посты.
3. Для каждой темы дай заголовок (жирный), краткое описание (2-3 предложения) и номера постов [#id].

Формат ответа — Markdown. Будь лаконичен, информативен и нейтрален.`;

const SCHEDULE_LABELS: Record<string, string> = {
  manual: "Вручную",
  daily: "Ежедневно",
  weekly: "Еженедельно",
};

function formatDate(s: string) {
  const d = new Date(s);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000) return d.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });
  if (diff < 604800000) return d.toLocaleDateString("ru", { weekday: "short", day: "numeric", month: "short" });
  return d.toLocaleDateString("ru", { day: "numeric", month: "short", year: "numeric" });
}

export default function DigestsPage() {
  const router = useRouter();
  
  // Вью мод
  const [showSettings, setShowSettings] = useState(false);
  const [digests, setDigests] = useState<Digest[]>([]);
  const [loadingDigests, setLoadingDigests] = useState(true);
  const [visibleCount, setVisibleCount] = useState(5);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Состояние настроек
  const [configs, setConfigs] = useState<DigestConfig[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [loadingConfigs, setLoadingConfigs] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [generatingId, setGeneratingId] = useState<number | null>(null);

  // Create form state
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [scheduleType, setScheduleType] = useState("manual");
  const [scheduleHours, setScheduleHours] = useState("8,20");
  const [periodHours, setPeriodHours] = useState(24);
  const [selectedSources, setSelectedSources] = useState<number[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.digestConfigs.list(), api.sources.list()])
      .then(([c, src]) => { setConfigs(c); setSources(src); })
      .finally(() => setLoadingConfigs(false));
  }, []);

  useEffect(() => {
    if (!showSettings) {
      setLoadingDigests(true);
      api.digests.list()
        .then(d => setDigests(d))
        .finally(() => setLoadingDigests(false));
    }
  }, [showSettings]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || loadingDigests || showSettings) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisibleCount((prev) => prev + 5);
      }
    }, { rootMargin: "400px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadingDigests, showSettings]);

  async function handleCreate() {
    if (!name.trim() || !prompt.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const cfg = await api.digestConfigs.create({
        name: name.trim(),
        prompt: prompt.trim(),
        schedule_type: scheduleType,
        schedule_hours: scheduleType !== "manual" ? scheduleHours : undefined,
        period_hours: periodHours,
        source_ids: selectedSources,
      });
      router.push(`/digests/${cfg.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    }
    setCreating(false);
  }

  async function handleGenerate(configId: number, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setGeneratingId(configId);
    try {
      const digest = await api.digestConfigs.generate(configId);
      router.push(`/digests/view/${digest.id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ошибка генерации");
    }
    setGeneratingId(null);
  }

  const visibleDigests = digests.slice(0, visibleCount);

  function renderMarkdown(text: string) {
    if (!text) return null;
    return (
      <div className="text-sm text-[var(--foreground)] whitespace-pre-wrap break-words select-text">
        {text.split('\n').map((line, i) => {
          const t = line.trim();
          if (t.startsWith('# ')) return <h3 key={i} className="font-semibold text-base mt-2 mb-1">{t.replace('# ', '')}</h3>;
          if (t.startsWith('## ')) return <h3 key={i} className="font-medium text-[var(--foreground)] mt-2 mb-1">{t.replace('## ', '')}</h3>;
          if (t.startsWith('### ')) return <h3 key={i} className="font-medium text-[var(--foreground)] mt-1 mb-1">{t.replace('### ', '')}</h3>;
          if (t === '') return <br key={i} />;
          const parts = line.split(/(\*\*.*?\*\*)/g);
          return (
            <div key={i}>
              {parts.map((p, j) => p.startsWith('**') && p.endsWith('**') ? <strong key={j} className="font-semibold">{p.slice(2, -2)}</strong> : p)}
            </div>
          );
        })}
      </div>
    );
  }

  if (loadingConfigs && loadingDigests) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold mb-4">Дайджесты</h1>
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-[var(--card)] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto pb-20">
      <div className="mb-6 flex flex-col items-start gap-1">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">{showSettings ? "Настройки дайджестов" : "Дайджесты"}</h1>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-1.5 transition-colors ${showSettings ? "text-[var(--accent)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}
            title="Настройки"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </button>
        </div>
        <p className="text-sm text-[var(--muted)]">{showSettings ? "Управление расписанием и промптами" : "AI-сводки новостей из ваших каналов"}</p>
      </div>

      {!showSettings ? (
        <>
          {loadingDigests ? (
            <div className="flex justify-center p-12">
              <div className="w-8 h-8 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
            </div>
          ) : digests.length === 0 ? (
            <div className="text-center p-12 text-[var(--muted)] bg-[var(--card)] rounded-xl border border-[var(--border)]">
              <span className="text-4xl mb-3 block">📭</span>
              <p>Вы пока не сгенерировали ни одного дайджеста</p>
              <p className="text-sm mt-2 opacity-80">Они генерируются автоматически, либо вы можете создать их в настройках.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {visibleDigests.map(digest => (
                <article key={digest.id} className="rounded-xl border bg-[var(--card)] p-4 hover:bg-[var(--card-hover)] transition-colors border-[var(--border)]">
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-8 h-8 rounded-full bg-[var(--card-hover)] overflow-hidden flex items-center justify-center shrink-0 text-[var(--muted)] text-base shadow-sm">
                      ✨
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium text-[var(--foreground)] truncate leading-tight">
                        {digest.config_name || "Сводка"}
                      </span>
                      <time className="text-xs text-[var(--muted)] leading-tight" dateTime={digest.created_at}>
                        {formatDate(digest.created_at)}
                      </time>
                    </div>
                  </div>
                  {renderMarkdown(digest.summary || "Нет содержимого")}
                </article>
              ))}
              {visibleCount < digests.length && (
                <div ref={sentinelRef} className="h-10 flex justify-center items-center">
                  <div className="w-6 h-6 rounded-full border-2 border-[var(--muted)] border-t-transparent animate-spin opacity-50"/>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-medium text-lg text-[var(--foreground)]">Ваши конфигурации</h2>
            <button
              type="button"
              onClick={() => setShowCreate((v) => !v)}
              className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
            >
              {showCreate ? "Закрыть" : "+ Добавить"}
            </button>
          </div>

          {showCreate && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-5 mb-6 shadow-sm">
              <h2 className="font-medium mb-3">Новый дайджест</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-[var(--muted)] block mb-1">Название</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Например: Утренний брифинг, Инвестиции за неделю"
                    className="w-full px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>

                <div>
                  <label className="text-sm text-[var(--muted)] block mb-1">Промпт для AI</label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={6}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-sm text-[var(--foreground)] font-mono focus:outline-none focus:border-[var(--accent)] resize-y"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-sm text-[var(--muted)] block mb-1">Расписание</label>
                    <select
                      value={scheduleType}
                      onChange={(e) => setScheduleType(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
                    >
                      <option value="manual">Вручную</option>
                      <option value="daily">Ежедневно</option>
                      <option value="weekly">Еженедельно (пн)</option>
                    </select>
                  </div>
                  {scheduleType !== "manual" && (
                    <div>
                      <label className="text-sm text-[var(--muted)] block mb-1">Часы UTC</label>
                      <input
                        value={scheduleHours}
                        onChange={(e) => setScheduleHours(e.target.value)}
                        placeholder="8,14,20"
                        className="w-full px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
                      />
                    </div>
                  )}
                  <div>
                    <label className="text-sm text-[var(--muted)] block mb-1">Период (часов)</label>
                    <input
                      type="number"
                      value={periodHours}
                      onChange={(e) => setPeriodHours(Number(e.target.value) || 24)}
                      min={1}
                      max={168}
                      className="w-full px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm text-[var(--muted)] block mb-1">
                    Источники {selectedSources.length > 0 && `(${selectedSources.length})`}
                    <span className="text-xs ml-1">(пусто = все каналы)</span>
                  </label>
                  <SourcePicker sources={sources} selected={selectedSources} onChange={setSelectedSources} />
                </div>

                {error && (
                  <div className="text-sm text-red-400">{error}</div>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={creating || !name.trim() || !prompt.trim()}
                    className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
                  >
                    {creating ? "Создаю…" : "Создать"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="px-4 py-2 rounded-lg bg-[var(--card)] text-[var(--muted)] text-sm hover:text-[var(--foreground)]"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            </div>
          )}

          {configs.length === 0 && !showCreate ? (
            <div className="text-center py-12 text-[var(--muted)]">
              <p className="text-lg mb-2">Настроек нет</p>
            </div>
          ) : (
            <div className="space-y-3 pb-20">
              {configs.map((cfg) => (
                <div
                  key={cfg.id}
                  className="flex items-center gap-4 p-4 rounded-xl border border-[var(--border)] bg-[var(--background)] hover:bg-[var(--card)] transition-colors"
                >
                  <Link href={`/digests/${cfg.id}`} className="flex-1 min-w-0 group flex items-center gap-4 cursor-pointer">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-violet-600 flex items-center justify-center text-lg shrink-0">
                      AI
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors">{cfg.name}</span>
                        {!cfg.is_active && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--card)] text-[var(--muted)]">выкл</span>
                        )}
                        <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--card)] text-[var(--muted)]">
                          {SCHEDULE_LABELS[cfg.schedule_type] || cfg.schedule_type}
                        </span>
                      </div>
                      <div className="text-xs text-[var(--muted)] mt-0.5">
                        {cfg.sources.length > 0 ? `${cfg.sources.length} источников` : "Все источники"} · {cfg.digest_count} дайджестов
                        {cfg.last_digest && ` · Последний: ${formatDate(cfg.last_digest.created_at)}`}
                      </div>
                    </div>
                  </Link>
                  <button
                    type="button"
                    onClick={(e) => handleGenerate(cfg.id, e)}
                    disabled={generatingId === cfg.id}
                    className="px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-xs font-medium hover:opacity-90 disabled:opacity-50 shrink-0"
                  >
                    {generatingId === cfg.id ? "…" : "Запустить"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
