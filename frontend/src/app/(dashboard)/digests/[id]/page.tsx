"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, type DigestConfig, type Digest, type Source } from "@/lib/api";
import { SourcePicker } from "@/components/SourcePicker";

const SCHEDULE_LABELS: Record<string, string> = {
  manual: "Вручную",
  daily: "Ежедневно",
  weekly: "Еженедельно (пн)",
};

function formatDate(s: string) {
  return new Date(s).toLocaleString("ru", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function DigestConfigDetailPage() {
  const params = useParams();
  const router = useRouter();
  const configId = Number(params.id);

  const [config, setConfig] = useState<DigestConfig | null>(null);
  const [digests, setDigests] = useState<Digest[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"history" | "settings">("history");
  const [generating, setGenerating] = useState(false);

  // Settings form
  const [editName, setEditName] = useState("");
  const [editPrompt, setEditPrompt] = useState("");
  const [editScheduleType, setEditScheduleType] = useState("manual");
  const [editScheduleHours, setEditScheduleHours] = useState("");
  const [editPeriodHours, setEditPeriodHours] = useState(24);
  const [editSources, setEditSources] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!configId) return;
    loadData();
  }, [configId]);

  async function loadData() {
    try {
      const [cfg, hist, src] = await Promise.all([
        api.digestConfigs.get(configId),
        api.digestConfigs.history(configId),
        api.sources.list(),
      ]);
      setConfig(cfg);
      setDigests(hist);
      setSources(src);
      // Populate settings form
      setEditName(cfg.name);
      setEditPrompt(cfg.prompt);
      setEditScheduleType(cfg.schedule_type);
      setEditScheduleHours(cfg.schedule_hours || "");
      setEditPeriodHours(cfg.period_hours);
      setEditSources(cfg.sources.map((s) => s.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      const digest = await api.digestConfigs.generate(configId);
      router.push(`/digests/view/${digest.id}`);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка генерации");
    }
    setGenerating(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await api.digestConfigs.update(configId, {
        name: editName,
        prompt: editPrompt,
        schedule_type: editScheduleType,
        schedule_hours: editScheduleType !== "manual" ? editScheduleHours : undefined,
        period_hours: editPeriodHours,
        source_ids: editSources,
      });
      setConfig(updated);
      setTab("history");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка сохранения");
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!confirm("Удалить этот дайджест-конфиг и всю историю генераций?")) return;
    try {
      await api.digestConfigs.delete(configId);
      router.push("/digests");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка удаления");
    }
  }

  if (error || (!loading && !config)) {
    return (
      <div className="p-8">
        <p className="text-red-400">{error || "Конфиг не найден"}</p>
        <Link href="/digests" className="text-[var(--accent)] mt-2 inline-block">← К дайджестам</Link>
      </div>
    );
  }

  if (loading || !config) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="h-8 w-48 bg-[var(--card)] rounded animate-pulse mb-4" />
        <div className="h-64 bg-[var(--card)] rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link href="/digests" className="text-sm text-[var(--muted)] hover:text-[var(--accent)] mb-4 inline-block">
        ← К дайджестам
      </Link>

      <header className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{config.name}</h1>
            {!config.is_active && (
              <span className="text-xs px-2 py-0.5 rounded bg-[var(--background)] text-[var(--muted)]">выкл</span>
            )}
          </div>
          <p className="text-sm text-[var(--muted)] mt-1">
            {SCHEDULE_LABELS[config.schedule_type] || config.schedule_type}
            {config.schedule_hours && ` в ${config.schedule_hours} UTC`}
            {" · "}За {config.period_hours}ч
            {" · "}{config.sources.length > 0 ? `${config.sources.length} источников` : "Все источники"}
          </p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {generating ? "Генерация…" : "Сгенерировать"}
        </button>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-[var(--border)]">
        {(["history", "settings"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {t === "history" ? "История" : "Настройки"}
          </button>
        ))}
      </div>

      {/* History tab */}
      {tab === "history" && (
        <div>
          {digests.length === 0 ? (
            <div className="text-center py-12 text-[var(--muted)]">
              <p>Ещё нет сгенерированных дайджестов</p>
              <p className="text-sm mt-1">Нажмите «Сгенерировать» для создания первого</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {digests.map((d) => (
                <li key={d.id}>
                  <Link
                    href={`/digests/view/${d.id}`}
                    className="block rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 hover:bg-[var(--card-hover)] transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{d.title}</span>
                      <span className="text-xs text-[var(--muted)] shrink-0 ml-2">{formatDate(d.created_at)}</span>
                    </div>
                    {d.summary && (
                      <p className="text-sm text-[var(--muted)] mt-2 line-clamp-2">{d.summary.slice(0, 200)}</p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Settings tab */}
      {tab === "settings" && (
        <div className="space-y-4">
          <div>
            <label className="text-sm text-[var(--muted)] block mb-1">Название</label>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div>
            <label className="text-sm text-[var(--muted)] block mb-1">Промпт для AI</label>
            <textarea
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
              rows={8}
              className="w-full px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm text-[var(--foreground)] font-mono focus:outline-none focus:border-[var(--accent)] resize-y"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-sm text-[var(--muted)] block mb-1">Расписание</label>
              <select
                value={editScheduleType}
                onChange={(e) => setEditScheduleType(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
              >
                <option value="manual">Вручную</option>
                <option value="daily">Ежедневно</option>
                <option value="weekly">Еженедельно (пн)</option>
              </select>
            </div>
            {editScheduleType !== "manual" && (
              <div>
                <label className="text-sm text-[var(--muted)] block mb-1">Часы UTC</label>
                <input
                  value={editScheduleHours}
                  onChange={(e) => setEditScheduleHours(e.target.value)}
                  placeholder="8,14,20"
                  className="w-full px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
            )}
            <div>
              <label className="text-sm text-[var(--muted)] block mb-1">Период (часов)</label>
              <input
                type="number"
                value={editPeriodHours}
                onChange={(e) => setEditPeriodHours(Number(e.target.value) || 24)}
                min={1}
                max={168}
                className="w-full px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>

          <div>
            <label className="text-sm text-[var(--muted)] block mb-1">
              Источники {editSources.length > 0 && `(${editSources.length})`}
              <span className="text-xs ml-1">(пусто = все каналы)</span>
            </label>
            <SourcePicker sources={sources} selected={editSources} onChange={setEditSources} />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Сохраняю…" : "Сохранить"}
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-[var(--border)]">
            <h3 className="text-sm font-medium text-red-400 mb-2">Опасная зона</h3>
            <button
              type="button"
              onClick={handleDelete}
              className="px-4 py-2 rounded-lg border border-red-500/30 text-red-400 text-sm hover:bg-red-500/10"
            >
              Удалить дайджест
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
