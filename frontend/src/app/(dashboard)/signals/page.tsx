"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, type Signal, type Source } from "@/lib/api";

interface BondSignalItem {
  id: number;
  condition_type: string;
  target_value: number;
  news_category: string | null;
  cron_minutes: number;
  notify_telegram: boolean;
  is_active: boolean;
  bond: {
    id: number;
    shortname: string;
    isin: string;
  };
}

export default function SignalsPage() {
  const router = useRouter();
  const [signals, setSignals] = useState<Signal[]>([]);
  const [bondSignals, setBondSignals] = useState<BondSignalItem[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  // Create form state
  const [name, setName] = useState("Инвестиции");
  const [selectedSources, setSelectedSources] = useState<number[]>([]);
  const [assetsText, setAssetsText] = useState("");
  const [creating, setCreating] = useState(false);

  // Edit bond signal state
  const [editingSignalId, setEditingSignalId] = useState<number | null>(null);
  const [editSignalForm, setEditSignalForm] = useState<{condition_type: string, target_value: string, news_category: string, cron_minutes: number, notify_telegram: boolean}>({
    condition_type: "price_less",
    target_value: "",
    news_category: "investments",
    cron_minutes: 15,
    notify_telegram: true
  });

  const fetchData = useCallback(() => {
    Promise.all([api.signals.list(), api.sources.list(), api.investments.portfolio()])
      .then(([s, src, p]) => { 
        setSignals(s); 
        setSources(src); 
        setBondSignals((p.signals as BondSignalItem[]) || []); 
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  const updateBondSignal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSignalId) return;
    if (!editSignalForm.target_value && editSignalForm.condition_type !== "news_mention") return;

    try {
      await api.investments.updateSignal(editingSignalId, {
        condition_type: editSignalForm.condition_type,
        target_value: editSignalForm.condition_type === "news_mention" ? null : parseFloat(editSignalForm.target_value),
        news_category: editSignalForm.news_category,
        cron_minutes: editSignalForm.cron_minutes,
        notify_telegram: editSignalForm.notify_telegram
      });
      fetchData();
      setEditingSignalId(null);
    } catch (e) {
      console.error(e);
      alert("Ошибка при обновлении сигнала");
    }
  };

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
              {bondSignals.map((sig: BondSignalItem) => (
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
                      {sig.condition_type === "yield_less" && `Доходность < ${sig.target_value}%`}
                      {sig.condition_type === "price_change_drop_greater" && `Падение > ${sig.target_value}%`}
                      {sig.condition_type === "price_change_grow_greater" && `Рост > ${sig.target_value}%`}
                      {sig.condition_type === "news_mention" && `Упоминание в новостях (Категория: ${sig.news_category || "investments"})`}
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setEditingSignalId(sig.id);
                      setEditSignalForm({
                        condition_type: sig.condition_type,
                        target_value: sig.target_value ? sig.target_value.toString() : "",
                        news_category: sig.news_category || "investments",
                        cron_minutes: sig.cron_minutes || 15,
                        notify_telegram: sig.notify_telegram !== false
                      });
                    }}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-[var(--card-hover)] text-[var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors"
                    title="Редактировать сигнал"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* EDIT SIGNAL MODAL */}
      {editingSignalId !== null && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-xl w-full max-w-md overflow-hidden animate-fade-in">
            <div className="p-6 border-b border-[var(--border)] flex justify-between items-center">
              <h3 className="font-semibold text-lg text-[var(--foreground)]">Редактировать сигнал</h3>
              <button type="button" onClick={() => setEditingSignalId(null)} className="text-[var(--muted)] hover:text-[var(--foreground)] p-1">✕</button>
            </div>
            <form onSubmit={updateBondSignal} className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-[var(--muted)] mb-2 font-medium">Событие</label>
                <select
                  className="w-full bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] rounded-lg px-4 py-2.5 outline-none focus:border-[var(--accent)] transition-colors"
                  value={editSignalForm.condition_type}
                  onChange={e => setEditSignalForm({...editSignalForm, condition_type: e.target.value})}
                >
                  <option value="price_less">Достижение цены (Упадет ниже)</option>
                  <option value="price_greater">Достижение цены (Вырастет выше)</option>
                  <option value="yield_less">Достижение доходности (Меньше)</option>
                  <option value="yield_greater">Достижение доходности (Больше)</option>
                  <option value="price_change_drop_greater">Сильное падение % (за сессию)</option>
                  <option value="price_change_grow_greater">Сильный рост % (за сессию)</option>
                  <option value="news_mention">Упоминание названия в новостях (парсер)</option>
                </select>
              </div>
              
              {editSignalForm.condition_type !== "news_mention" && (
                <div className="animate-fade-in">
                  <label className="block text-sm text-[var(--muted)] mb-2 font-medium">Значение</label>
                  <input
                    type="number" step="0.01" required
                    className="w-full bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] rounded-lg px-4 py-2.5 outline-none focus:border-[var(--accent)] transition-colors"
                    placeholder="Укажите порог"
                    value={editSignalForm.target_value}
                    onChange={e => setEditSignalForm({...editSignalForm, target_value: e.target.value})}
                  />
                </div>
              )}

              {editSignalForm.condition_type === "news_mention" && (
                <div className="animate-fade-in space-y-4">
                  <div>
                    <label className="block text-sm text-[var(--muted)] mb-2 font-medium">Категория новостей</label>
                    <select
                      className="w-full bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] rounded-lg px-4 py-2.5 outline-none focus:border-[var(--accent)] transition-colors"
                      value={editSignalForm.news_category}
                      onChange={e => setEditSignalForm({...editSignalForm, news_category: e.target.value})}
                    >
                      {Array.from(new Set(sources.map(s => s.category).filter(Boolean))).map(cat => (
                        <option key={cat} value={cat as string}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-[var(--muted)] mb-2 font-medium">Периодичность проверки</label>
                    <select
                      className="w-full bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] rounded-lg px-4 py-2.5 outline-none focus:border-[var(--accent)] transition-colors"
                      value={editSignalForm.cron_minutes}
                      onChange={e => setEditSignalForm({...editSignalForm, cron_minutes: Number(e.target.value)})}
                    >
                      <option value="15">Каждые 15 минут</option>
                      <option value="60">Каждый час</option>
                      <option value="360">Раз в 6 часов</option>
                      <option value="1440">Раз в день</option>
                    </select>
                  </div>
                </div>
              )}

              <label className="flex items-center gap-3 cursor-pointer mt-2">
                <input type="checkbox" className="w-5 h-5 rounded border-[var(--border)] text-[var(--accent)]" checked={editSignalForm.notify_telegram} onChange={e => setEditSignalForm({...editSignalForm, notify_telegram: e.target.checked})} />
                <span className="font-medium text-sm text-[var(--foreground)]">Уведомление в Telegram</span>
              </label>
              
              <div className="pt-4">
                <button type="submit" className="w-full bg-[var(--accent)] text-white px-4 py-3 rounded-xl font-semibold hover:opacity-90 transition-opacity flex justify-center items-center">
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
