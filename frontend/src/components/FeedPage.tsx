"use client";

import { useCallback, useEffect, useRef, useState, Fragment } from "react";
import { api, type Post, type Digest } from "@/lib/api";
import { PostCard } from "@/components/PostCard";
import { CATEGORY_DEFS, type CategoryDef } from "@/lib/categories";

const ALL_ITEM: CategoryDef = { value: "", label: "Все", icon: "◆", gradient: "from-gray-600 to-gray-800" };

const PAGE_SIZE = 50;
const NEW_POST_TTL = 60_000;

export default function FeedPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<string>("");
  const [feedCategories, setFeedCategories] = useState<CategoryDef[]>([ALL_ITEM]);
  const [newPostIds, setNewPostIds] = useState<Set<number>>(new Set());
  const knownIdsRef = useRef<Set<number>>(new Set());
  const sentinelRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  const [showSettings, setShowSettings] = useState(false);
  const [hideAds, setHideAds] = useState(false);
  const [childMode, setChildMode] = useState(false);

  // Сводка
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summaryPeriod, setSummaryPeriod] = useState<"today" | "yesterday" | "week">("today");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryData, setSummaryData] = useState<Digest | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const loadSummary = useCallback(async (period: "today" | "yesterday" | "week") => {
    setSummaryLoading(true);
    setSummaryError(null);
    setSummaryData(null);
    
    const now = new Date();
    const start = new Date();
    const end = new Date();
    
    if (period === "today") {
      start.setHours(0, 0, 0, 0);
    } else if (period === "yesterday") {
      start.setDate(now.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(now.getDate() - 1);
      end.setHours(23, 59, 59, 999);
    } else if (period === "week") {
      start.setDate(now.getDate() - 7);
      start.setHours(0, 0, 0, 0);
    }
    
    try {
      const res = await api.digests.generate({
        type: "summary",
        period_start: start.toISOString(),
        period_end: end.toISOString()
      });
      setSummaryData(res);
    } catch (e) {
      setSummaryError((e as Error).message || "Ошибка загрузки сводки");
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (showSummaryModal) {
      loadSummary(summaryPeriod);
    }
  }, [showSummaryModal, summaryPeriod, loadSummary]);

  useEffect(() => {
    setHideAds(localStorage.getItem("hideAds") === "true");
    setChildMode(localStorage.getItem("childMode") === "true");
  }, []);

  const toggleHideAds = () => {
    const newVal = !hideAds;
    setHideAds(newVal);
    localStorage.setItem("hideAds", String(newVal));
  };

  const toggleChildMode = () => {
    const newVal = !childMode;
    setChildMode(newVal);
    localStorage.setItem("childMode", String(newVal));
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettings(false);
      }
    };
    if (showSettings) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSettings]);

  // В ленте показываем только категории, у которых есть добавленные источники (show_in_feed)
  useEffect(() => {
    api.sources
      .list()
      .then((sources) => {
        const withFeed = sources.filter((s) => s.show_in_feed !== false);
        const cats = new Set<string>();
        withFeed.forEach((s) => cats.add(s.category || "other"));
        const ordered = CATEGORY_DEFS.filter((c) => cats.has(c.value));
        setFeedCategories([ALL_ITEM, ...ordered]);
      })
      .catch(() => {});
  }, []);

  // Load first page or silent refresh (only refreshes first page)
  const loadPosts = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    const params: Record<string, string | number> = { limit: PAGE_SIZE, offset: 0 };
    if (category) params.category = category;
    api.posts
      .list(params)
      .then((fetched) => {
        if (silent && knownIdsRef.current.size > 0) {
          const fresh = fetched.filter((p) => !knownIdsRef.current.has(p.id)).map((p) => p.id);
          if (fresh.length > 0) {
            setNewPostIds((prev) => new Set([...Array.from(prev), ...fresh]));
            setTimeout(() => {
              setNewPostIds((prev) => {
                const next = new Set(prev);
                fresh.forEach((id) => next.delete(id));
                return next;
              });
            }, NEW_POST_TTL);
          }
        }
        fetched.forEach((p) => knownIdsRef.current.add(p.id));
        if (silent) {
          // Merge new posts at the top, keep already loaded older posts
          setPosts((prev) => {
            const existingIds = new Set(prev.map((p) => p.id));
            // Update existing posts (e.g. favorite state) and prepend truly new ones
            const updated = prev.map((p) => {
              const fresh = fetched.find((f) => f.id === p.id);
              return fresh ?? p;
            });
            const brandNew = fetched.filter((f) => !existingIds.has(f.id));
            return [...brandNew, ...updated];
          });
        } else {
          setPosts(fetched);
          setHasMore(fetched.length >= PAGE_SIZE);
        }
      })
      .catch((e) => !silent && setError(e.message))
      .finally(() => { if (!silent) setLoading(false); });
  }, [category]);

  // Load next page
  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const params: Record<string, string | number> = { limit: PAGE_SIZE, offset: posts.length };
    if (category) params.category = category;
    api.posts
      .list(params)
      .then((fetched) => {
        fetched.forEach((p) => knownIdsRef.current.add(p.id));
        setPosts((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const unique = fetched.filter((p) => !existingIds.has(p.id));
          return [...prev, ...unique];
        });
        setHasMore(fetched.length >= PAGE_SIZE);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  }, [loadingMore, hasMore, posts.length, category]);

  // Initial load + reset on category change
  useEffect(() => {
    setPosts([]);
    setHasMore(true);
    knownIdsRef.current.clear();
    loadPosts(false);
  }, [loadPosts]);

  // Auto-refresh every 45s
  useEffect(() => {
    const interval = setInterval(() => loadPosts(true), 45_000);
    return () => clearInterval(interval);
  }, [loadPosts]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore(); },
      { rootMargin: "400px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  if (error) {
    return (
      <div className="p-8">
        <p className="text-red-400">Ошибка: {error}. Проверьте, что вы авторизованы и backend запущен.</p>
      </div>
    );
  }

  return (
    <div className="px-4 pb-6 md:p-6 max-w-3xl mx-auto">
      <header className="mb-4 relative z-10">
        <div className="flex items-start justify-between">
          <div className="hidden md:block">
            <h1 className="text-2xl font-semibold">Лента</h1>
            <p className="text-sm text-[var(--muted)] mb-4">Публикации из подключённых источников. Обновляется автоматически.</p>
          </div>
          
          <div className="absolute right-0 top-0 md:static flex flex-col items-end" ref={settingsRef}>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-1.5 text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--card-hover)] rounded-md transition-colors"
              title="Настройки ленты"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
            
            {showSettings && (
              <div className="absolute right-0 top-8 w-64 bg-[var(--card)] border border-[var(--border)] shadow-xl rounded-xl p-3 z-50 animate-in fade-in slide-in-from-top-2 flex flex-col gap-3">
                <div className="flex items-center justify-between group relative">
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-medium hover:text-[var(--accent)] transition-colors">
                    <input
                      type="checkbox"
                      checked={hideAds}
                      onChange={toggleHideAds}
                      className="rounded border-[var(--border)] bg-[var(--background)] text-[var(--accent)] focus:ring-[var(--accent)]"
                    />
                    Отключить рекламу
                  </label>
                  
                  <div className="text-[var(--muted)] hover:text-[var(--foreground)] cursor-help p-1">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                      <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>
                    </svg>
                  </div>
                  
                  <div className="absolute invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-all bottom-full right-0 mb-2 w-48 bg-gray-800 text-white text-xs p-2 rounded shadow-lg pointer-events-none z-50">
                    Отключение постов с рекламой и рекламными интеграциями.
                  </div>
                </div>

                <div className="flex items-center justify-between group relative">
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-medium hover:text-[var(--accent)] transition-colors">
                    <input
                      type="checkbox"
                      checked={childMode}
                      onChange={toggleChildMode}
                      className="rounded border-[var(--border)] bg-[var(--background)] text-[var(--accent)] focus:ring-[var(--accent)]"
                    />
                    Детский режим
                  </label>
                  
                  <div className="text-[var(--muted)] hover:text-[var(--foreground)] cursor-help p-1">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                      <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>
                    </svg>
                  </div>
                  
                  <div className="absolute invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-all bottom-full right-0 mb-2 w-48 bg-gray-800 text-white text-xs p-2 rounded shadow-lg pointer-events-none z-50">
                    Скрывает из ленты новости, содержащие нецензурную лексику.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 overflow-x-auto pt-[4.75rem] md:pt-3 px-2 pb-3 scrollbar-hide">
          {feedCategories.map((c) => {
            const isActive = (c.value === "" && !category) || category === c.value;
            const btn = (
              <button
                key={c.value || "all"}
                type="button"
                onClick={() => setCategory(c.value)}
                className="flex flex-col items-center gap-1.5 shrink-0 group"
              >
                <div
                  className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${c.gradient} flex items-center justify-center text-xl shadow-lg transition-all ${
                    isActive
                      ? "ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--background)] scale-105"
                      : "opacity-70 group-hover:opacity-100 group-hover:scale-105"
                  }`}
                >
                  {c.icon}
                </div>
                <span className={`text-[11px] leading-tight transition-colors ${
                  isActive ? "text-[var(--foreground)] font-semibold" : "text-[var(--muted)] group-hover:text-[var(--foreground)]"
                }`}>
                  {c.label}
                </span>
              </button>
            );

            if (c.value === "") {
              return (
                <Fragment key={c.value || "all"}>
                  {btn}
                  <button
                    type="button"
                    onClick={() => setShowSummaryModal(true)}
                    className="flex flex-col items-center gap-1.5 shrink-0 group"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xl shadow-lg transition-all opacity-70 group-hover:opacity-100 group-hover:scale-105 group-active:scale-95">
                      ✨
                    </div>
                    <span className="text-[11px] leading-tight transition-colors text-[var(--muted)] group-hover:text-[var(--foreground)]">
                      Сводка
                    </span>
                  </button>
                </Fragment>
              );
            }
            return btn;
          })}
        </div>
      </header>
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 rounded-xl bg-[var(--card)] animate-pulse" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 text-center text-[var(--muted)]">
          <p className="mb-2">Пока нет публикаций.</p>
          <p className="text-sm">Добавьте каналы в разделе «Источники» и один раз войдите в Telegram на сервере: <code className="bg-[var(--background)] px-1.5 py-0.5 rounded">docker compose -p mylent exec -it backend python -m scripts.telegram_sync</code>. Парсер подтянет посты автоматически.</p>
        </div>
      ) : (
        <>
          <ul className="space-y-4">
            {posts.filter(post => {
              const textLower = post.raw_text ? post.raw_text.toLowerCase() : "";
              
              if (hideAds) {
                if (textLower.includes("#реклама") || textLower.includes("erid=") || textLower.includes("реклама. ооо") || textLower.includes("партнерский материал") || textLower.includes("партнерский пост")) return false;
              }

              if (childMode) {
                const badRootsRegex = /(^|[^а-яё])(хуй|хуе|хуя|пизд|ебат|ебан|уеб|бляд|блят|сука|суки|пидор|педик)/i;
                if (badRootsRegex.test(textLower)) return false;
              }
              
              return true;
            }).map((post) => (
              <li key={post.id}>
                <PostCard
                  post={post}
                  isNew={newPostIds.has(post.id)}
                  onToggleFavorite={(p) => setPosts((prev) => prev.map((x) => x.id === p.id ? { ...x, is_favorite: !x.is_favorite } : x))}
                />
              </li>
            ))}
          </ul>
          {/* Sentinel for infinite scroll */}
          <div ref={sentinelRef} className="h-1" />
          {loadingMore && (
            <div className="flex justify-center py-6">
              <div className="h-8 w-8 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
            </div>
          )}
          {!hasMore && posts.length > PAGE_SIZE && (
            <p className="text-center text-sm text-[var(--muted)] py-6">Все публикации загружены</p>
          )}
        </>
      )}

      {/* Модальное окно Сводки */}
      {showSummaryModal && (
        <div className="fixed inset-0 z-[100] flex justify-end bg-black/50 backdrop-blur-sm animate-in fade-in" onClick={() => setShowSummaryModal(false)}>
          <div className="w-full md:w-[600px] h-full bg-[var(--background)] border-l border-[var(--border)] shadow-2xl flex flex-col animate-in slide-in-from-right" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)] bg-[var(--card)]">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">✨ Сводка от ИИ</h2>
                <p className="text-xs text-[var(--muted)]">Сгенерировано AI-агентом DeepSeek</p>
              </div>
              <button onClick={() => setShowSummaryModal(false)} className="p-2 bg-[var(--background)] hover:bg-[var(--card-hover)] rounded-full transition-colors">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            
            {/* Tabs */}
            <div className="flex p-4 gap-2 border-b border-[var(--border)] bg-[var(--card)] overflow-x-auto scrollbar-hide">
              {(["today", "yesterday", "week"] as const).map((period) => (
                <button
                  key={period}
                  onClick={() => setSummaryPeriod(period)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${summaryPeriod === period ? "bg-[var(--accent)] text-white shadow-md" : "bg-[var(--background)] text-[var(--muted)] hover:text-[var(--foreground)]"}`}
                >
                  {period === "today" ? "За сегодня" : period === "yesterday" ? "За вчера" : "За неделю"}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 relative bg-[var(--background)] select-text">
              {summaryLoading ? (
                <div className="flex flex-col items-center justify-center h-40 gap-4 text-[var(--muted)]">
                  <div className="w-8 h-8 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin"/>
                  <p className="text-sm font-medium animate-pulse">DeepSeek читает посты и генерирует сводку...</p>
                </div>
              ) : summaryError ? (
                <div className="p-4 bg-red-500/10 text-red-500 rounded-xl border border-red-500/20 text-center">
                  <p className="font-medium mb-1">Не удалось сформировать сводку</p>
                  <p className="text-sm opacity-80">{summaryError}</p>
                  <button onClick={() => loadSummary(summaryPeriod)} className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-sm transition-colors">Повторить</button>
                </div>
              ) : summaryData?.summary ? (
                <div className="prose prose-invert max-w-none prose-p:leading-relaxed prose-headings:mt-6 prose-headings:mb-4 prose-a:text-[var(--accent)] prose-a:no-underline hover:prose-a:underline">
                  {summaryData.summary.split('\n').map((line, i) => {
                    const t = line.trim();
                    if (t.startsWith('# ')) return <h1 key={i} className="text-2xl font-bold mt-2 mb-4">{t.replace('# ', '')}</h1>;
                    if (t.startsWith('## ')) return <h2 key={i} className="text-xl font-bold mt-6 mb-3 text-[var(--foreground)]">{t.replace('## ', '')}</h2>;
                    if (t.startsWith('### ')) return <h3 key={i} className="text-lg font-semibold mt-4 mb-2 text-[var(--foreground)]">{t.replace('### ', '')}</h3>;
                    if (t === '') return <div key={i} className="h-3" />;
                    // basic bold replacing `**text**`
                    const parts = line.split(/(\*\*.*?\*\*)/g);
                    return (
                      <p key={i} className="text-sm md:text-base leading-relaxed text-[var(--foreground)] opacity-90 mb-2">
                        {parts.map((p, j) => 
                          p.startsWith('**') && p.endsWith('**') ? <strong key={j} className="text-[var(--foreground)] font-semibold">{p.slice(2, -2)}</strong> : p
                        )}
                      </p>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center p-8 text-[var(--muted)] bg-[var(--card)] rounded-xl border border-[var(--border)]">
                  <span className="text-3xl mb-3 block">📭</span>
                  <p>За этот период новостей пока нет</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
