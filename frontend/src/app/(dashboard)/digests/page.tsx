"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, type DigestConfig, type Source } from "@/lib/api";
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
  return new Date(s).toLocaleDateString("ru", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function DigestsPage() {
  const router = useRouter();
  const [configs, setConfigs] = useState<DigestConfig[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
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
      .finally(() => setLoading(false));
  }, []);

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

  if (loading) {
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
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold">Дайджесты</h1>
          <p className="text-sm text-[var(--muted)]">AI-сводки новостей из ваших каналов</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          + Создать
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 mb-6">
          <h2 className="font-medium mb-3">Новый дайджест</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-[var(--muted)] block mb-1">Название</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Например: Утренний брифинг, Инвестиции за неделю"
                className="w-full px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div>
              <label className="text-sm text-[var(--muted)] block mb-1">Промпт для AI</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={6}
                className="w-full px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm text-[var(--foreground)] font-mono focus:outline-none focus:border-[var(--accent)] resize-y"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-sm text-[var(--muted)] block mb-1">Расписание</label>
                <select
                  value={scheduleType}
                  onChange={(e) => setScheduleType(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
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
                    className="w-full px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
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
                  className="w-full px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
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
                className="px-4 py-2 rounded-lg bg-[var(--background)] text-[var(--muted)] text-sm hover:text-[var(--foreground)]"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Configs list */}
      {configs.length === 0 && !showCreate ? (
        <div className="text-center py-12 text-[var(--muted)]">
          <p className="text-lg mb-2">Нет дайджестов</p>
          <p className="text-sm">Создайте дайджест, чтобы AI делал сводки новостей из ваших каналов</p>
        </div>
      ) : (
        <div className="space-y-3">
          {configs.map((cfg) => (
            <Link
              key={cfg.id}
              href={`/digests/${cfg.id}`}
              className="flex items-center gap-4 p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--card-hover)] transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-violet-600 flex items-center justify-center text-lg shrink-0">
                AI
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[var(--foreground)]">{cfg.name}</span>
                  {!cfg.is_active && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--background)] text-[var(--muted)]">выкл</span>
                  )}
                  <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--background)] text-[var(--muted)]">
                    {SCHEDULE_LABELS[cfg.schedule_type] || cfg.schedule_type}
                  </span>
                </div>
                <div className="text-xs text-[var(--muted)] mt-0.5">
                  {cfg.sources.length > 0 ? `${cfg.sources.length} источников` : "Все источники"} · {cfg.digest_count} дайджестов
                  {cfg.last_digest && ` · Последний: ${formatDate(cfg.last_digest.created_at)}`}
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => handleGenerate(cfg.id, e)}
                disabled={generatingId === cfg.id}
                className="px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-xs font-medium hover:opacity-90 disabled:opacity-50 shrink-0"
              >
                {generatingId === cfg.id ? "…" : "Создать"}
              </button>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--muted)] shrink-0">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
