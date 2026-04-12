"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, type Signal, type Source, type GlobalSignalFeedItem, type Post } from "@/lib/api";
import { PostCard } from "@/components/PostCard";
import { getCategoryDef } from "@/lib/categories";

interface BondSignalItem {
  id: number;
  condition_type: string;
  target_value: number;
  news_category: string | null;
  cron_minutes: number;
  notify_telegram: boolean;
  is_active: boolean;
  unread_count?: number;
  bond: {
    id: number;
    shortname: string;
    isin: string;
  };
}



export default function SignalsPage() {
  const router = useRouter();
  
  // Tabs
  const [activeTab, setActiveTab] = useState<"feed" | "settings">("feed");

  // Settings State
  const [signals, setSignals] = useState<Signal[]>([]);
  const [bondSignals, setBondSignals] = useState<BondSignalItem[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  // Feed State
  const [feedItems, setFeedItems] = useState<GlobalSignalFeedItem[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(true);

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
    news_category: "",
    cron_minutes: 1,
    notify_telegram: true
  });

  const fetchSettingsData = useCallback(() => {
    Promise.all([api.signals.list(), api.sources.list(), api.investments.portfolio()])
      .then(([s, src, p]) => { 
        setSignals(s); 
        setSources(src); 
        setBondSignals((p.signals as BondSignalItem[]) || []); 
      })
      .finally(() => setLoadingSettings(false));
  }, []);

  const fetchFeedData = useCallback(() => {
    api.signals.globalFeed()
      .then((res) => {
        setFeedItems(res.feed);
      })
      .finally(() => setLoadingFeed(false));
  }, []);

  useEffect(() => {
    if (activeTab === "settings") {
      fetchSettingsData();
    } else {
      fetchFeedData();
    }
  }, [activeTab, fetchSettingsData, fetchFeedData]);

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);
    try {
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
      fetchSettingsData();
      setEditingSignalId(null);
    } catch (e) {
      console.error(e);
      alert("Ошибка при обновлении сигнала");
    }
  };

  const removeBondSignal = async (id: number) => {
    if (!confirm("Удалить сигнал?")) return;
    try {
      await api.investments.removeSignal(id);
      fetchSettingsData();
    } catch {
      alert("Ошибка при удалении");
    }
  };

  function toggleSource(id: number) {
    setSelectedSources((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  // Mapper to turn `GlobalSignalFeedItem.post` into `Post` layout so we can use `PostCard`
  const mapToPost = (feedItem: GlobalSignalFeedItem): Post => {
    const defaultMediaJson = feedItem.post?.media_files ? JSON.stringify({ 
      photos: feedItem.post.media_files.filter(m => m.type === 'photo').map(m => ({url: m.url})),
      videos: feedItem.post.media_files.filter(m => m.type === 'video').map(m => ({url: m.url}))
    }) : null;

    return {
      id: feedItem.post?.id || feedItem.db_id,
      title: null,
      raw_text: feedItem.post?.text || feedItem.message || "",
      cleaned_text: feedItem.post?.text || feedItem.message || "",
      preview_text: feedItem.post?.text || feedItem.message || "",
      original_url: feedItem.post?.original_url || null,
      source_id: 0,
      external_id: "",
      published_at: feedItem.post?.created_at || feedItem.created_at,
      imported_at: feedItem.post?.created_at || feedItem.created_at,
      updated_at: feedItem.post?.created_at || feedItem.created_at,
      media_json: defaultMediaJson,
      language: "ru",
      read_status: feedItem.is_read ? "read" : "unread",
      is_favorite: false,
      is_hidden: false,
      is_archived: false,
      ai_analysis: null,
      source: feedItem.post?.source_title ? {
        id: 0,
        type: "telegram",
        title: feedItem.post.source_title,
        category: null,
        config_json: null
      } : null
    };
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold">Сигналы</h1>
          <p className="text-sm text-[var(--muted)]">Глобальная лента срабатываний ваших активов</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-[var(--border)]">
        <button
          onClick={() => setActiveTab("feed")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "feed"
              ? "border-[var(--accent)] text-[var(--accent)]"
              : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
          }`}
        >
          Сработанные сообщения
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "settings"
              ? "border-[var(--accent)] text-[var(--accent)]"
              : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
          }`}
        >
          Настройки сигналов
        </button>
      </div>

      {/* TAB: FEED */}
      {activeTab === "feed" && (
        <div className="space-y-4">
          {loadingFeed ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 rounded-xl bg-[var(--card)] animate-pulse" />
              ))}
            </div>
          ) : feedItems.length === 0 ? (
            <div className="text-center py-12 text-[var(--muted)] border border-[var(--border)] border-dashed rounded-xl">
              <p className="text-lg mb-2">Новостей пока нет</p>
              <p className="text-sm">Сигналы отслеживают упоминания ваших активов в фоне. Когда они появятся, они отобразятся здесь.</p>
            </div>
          ) : (
            feedItems.map((item) => (
              <div key={item.global_id} className="relative group">
                {/* News Card itself */}
                <PostCard 
                  post={mapToPost(item)} 
                  isNew={!item.is_read} 
                />

                {/* Info badge at the bottom of the card indicating source */}
                <Link 
                  href={item.type === "text" ? `/signals/${item.signal_id}` : `/signals/bond/${item.signal_id}`}
                  className="mt-2 inline-flex flex-wrap items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)] transition-colors text-xs font-medium text-[var(--muted)] hover:text-[var(--foreground)] w-full"
                >
                  <span className="flex items-center justify-center w-5 h-5 rounded-md bg-[var(--background)] shrink-0">
                    {item.type === "text" ? "📈" : "₽"}
                  </span>
                  <span>
                    Сработало на {item.type === "text" ? "сигнале" : "облигации"}: <span className="text-[var(--foreground)]">{item.origin_name}</span>
                  </span>
                  {item.type === "text" && item.asset_name && (
                    <>
                      <span className="text-[var(--border)]">|</span>
                      <span>Актив: <span className="text-[var(--foreground)]">{item.asset_name}</span></span>
                    </>
                  )}
                  {item.message && (
                    <>
                      <span className="text-[var(--border)]">|</span>
                      <span className="truncate max-w-[200px]">{item.message}</span>
                    </>
                  )}
                </Link>
                
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1 z-10 pointer-events-none">
                  <div className="px-2 py-1 rounded bg-black/50 text-white text-[10px] font-bold uppercase backdrop-blur-md">
                    {item.type === "text" ? "Парсер Текста" : "Финансовый сигнал"}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB: SETTINGS */}
      {activeTab === "settings" && (
        <div className="animate-fade-in">
          {loadingSettings ? (
            <div className="space-y-3 mt-4">
              {[1, 2].map((i) => (
                <div key={i} className="h-20 rounded-xl bg-[var(--card)] animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              <div className="flex justify-end mb-4">
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
                        <Link
                          href={`/signals/bond/${sig.id}`}
                          key={`bond-${sig.id}`}
                          className="flex items-center gap-4 p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] opacity-90 hover:border-[var(--accent)] transition-colors cursor-pointer group"
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
                              {sig.condition_type === "news_mention" && (sig.news_category ? `Упоминание в новостях (Категория: ${getCategoryDef(sig.news_category)?.label || sig.news_category})` : "Упоминание в новостях (Любая категория)")}
                            </div>
                          </div>
                          <button 
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setEditingSignalId(sig.id);
                              setEditSignalForm({
                                condition_type: sig.condition_type,
                                target_value: sig.target_value ? sig.target_value.toString() : "",
                                news_category: sig.news_category || "",
                                cron_minutes: sig.cron_minutes || 1,
                                notify_telegram: sig.notify_telegram !== false
                              });
                            }}
                            className="w-8 h-8 flex items-center justify-center rounded-full bg-[var(--card-hover)] text-[var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors z-10 relative"
                            title="Редактировать сигнал"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                          </button>
                          <button 
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              removeBondSignal(sig.id);
                            }} 
                            className="w-8 h-8 flex items-center justify-center rounded-full bg-[var(--card-hover)] text-[var(--muted)] hover:bg-red-500/10 hover:text-red-500 transition-colors z-10 relative"
                            title="Удалить сигнал"
                          >
                            ✕
                          </button>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
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
                          <option value="">Все категории (Любая)</option>
                          {Array.from(new Set(sources.map(s => s.category).filter(Boolean))).map(cat => {
                            const label = getCategoryDef(cat as string)?.label || cat;
                            return <option key={cat as string} value={cat as string}>{label}</option>
                          })}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm text-[var(--muted)] mb-2 font-medium">Периодичность проверки</label>
                        <select
                          className="w-full bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] rounded-lg px-4 py-2.5 outline-none focus:border-[var(--accent)] transition-colors"
                          value={editSignalForm.cron_minutes}
                          onChange={e => setEditSignalForm({...editSignalForm, cron_minutes: Number(e.target.value)})}
                        >
                          <option value="1">Мгновенная (сразу)</option>
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
      )}
    </div>
  );
}
