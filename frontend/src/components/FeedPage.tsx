"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, type Post } from "@/lib/api";
import { PostCard } from "@/components/PostCard";
import { CATEGORY_DEFS, type CategoryDef } from "@/lib/categories";

const ALL_ITEM: CategoryDef = { value: "", label: "Все", icon: "◆", gradient: "from-gray-600 to-gray-800" };

const PAGE_SIZE = 50;
const NEW_POST_TTL = 60_000;
const POST_READ_VISIBLE_RATIO = 0.25;
const POST_READ_DELAY_MS = 400;
const PENDING_READ_STORAGE_KEY = "mylent_pending_read_ids_v1";

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
  const postElementsRef = useRef(new Map<number, HTMLLIElement>());
  const markReadTimersRef = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const readInFlightRef = useRef(new Set<number>());
  const pendingReadIdsRef = useRef(new Set<number>());

  const [showSettings, setShowSettings] = useState(false);
  const [hideAds, setHideAds] = useState(false);
  const [childMode, setChildMode] = useState(false);
  const [collapseCategories, setCollapseCategories] = useState(false);
  const [onlyNewPosts, setOnlyNewPosts] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const persistPendingReadIds = useCallback((ids: Set<number>) => {
    if (typeof window === "undefined") return;
    if (ids.size === 0) {
      localStorage.removeItem(PENDING_READ_STORAGE_KEY);
      return;
    }
    localStorage.setItem(PENDING_READ_STORAGE_KEY, JSON.stringify(Array.from(ids)));
  }, []);

  useEffect(() => {
    setHideAds(localStorage.getItem("hideAds") === "true");
    setChildMode(localStorage.getItem("childMode") === "true");
    setCollapseCategories(localStorage.getItem("collapseCategories") === "true");
    setOnlyNewPosts(localStorage.getItem("onlyNewPosts") === "true");
    try {
      const raw = localStorage.getItem(PENDING_READ_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as number[];
        const pendingIds = new Set(parsed.filter((value) => Number.isFinite(value)));
        pendingReadIdsRef.current = pendingIds;
      }
    } catch {
      pendingReadIdsRef.current = new Set();
    }
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

  const toggleCollapseCategories = () => {
    const newVal = !collapseCategories;
    setCollapseCategories(newVal);
    localStorage.setItem("collapseCategories", String(newVal));
  };

  const toggleOnlyNewPosts = () => {
    const newVal = !onlyNewPosts;
    setOnlyNewPosts(newVal);
    localStorage.setItem("onlyNewPosts", String(newVal));
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

  useEffect(() => {
    const openFeedSettings = () => setShowSettings(true);
    window.addEventListener("open_feed_settings", openFeedSettings);
    return () => window.removeEventListener("open_feed_settings", openFeedSettings);
  }, []);

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

  const flushPendingReadIds = useCallback(async () => {
    const ids = Array.from(pendingReadIdsRef.current);
    if (ids.length === 0) return;

    const results = await Promise.allSettled(ids.map((postId) => api.posts.read(postId)));
    const failedIds = new Set<number>();
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        failedIds.add(ids[index]);
      }
    });
    pendingReadIdsRef.current = failedIds;
    persistPendingReadIds(failedIds);
  }, [persistPendingReadIds]);

  const loadPosts = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    await flushPendingReadIds();
    const params: Record<string, string | number | boolean> = { limit: PAGE_SIZE, offset: 0 };
    if (category) params.category = category;
    if (onlyNewPosts) params.only_unread = true;
    return api.posts
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
          setPosts((prev) => {
            const existingIds = new Set(prev.map((p) => p.id));
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
  }, [category, onlyNewPosts, flushPendingReadIds]);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const params: Record<string, string | number | boolean> = { limit: PAGE_SIZE, offset: posts.length };
    if (category) params.category = category;
    if (onlyNewPosts) params.only_unread = true;
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
  }, [loadingMore, hasMore, posts.length, category, onlyNewPosts]);

  useEffect(() => {
    setPosts([]);
    setHasMore(true);
    knownIdsRef.current.clear();
    loadPosts(false);
  }, [loadPosts]);

  useEffect(() => {
    const interval = setInterval(() => loadPosts(true), 45_000);
    return () => clearInterval(interval);
  }, [loadPosts]);

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

  const setPostElement = useCallback((postId: number, element: HTMLLIElement | null) => {
    if (element) {
      postElementsRef.current.set(postId, element);
      return;
    }
    postElementsRef.current.delete(postId);
    const timer = markReadTimersRef.current.get(postId);
    if (timer) {
      clearTimeout(timer);
      markReadTimersRef.current.delete(postId);
    }
  }, []);

  const markPostRead = useCallback((postId: number) => {
    if (readInFlightRef.current.has(postId)) return;
    const post = posts.find((item) => item.id === postId);
    if (!post || post.read_status === "read") return;

    pendingReadIdsRef.current.add(postId);
    persistPendingReadIds(pendingReadIdsRef.current);
    readInFlightRef.current.add(postId);
    setPosts((prev) => prev.map((item) => item.id === postId ? { ...item, read_status: "read" } : item));
    api.posts
      .read(postId)
      .then(() => {
        pendingReadIdsRef.current.delete(postId);
        persistPendingReadIds(pendingReadIdsRef.current);
      })
      .catch(() => {})
      .finally(() => {
        readInFlightRef.current.delete(postId);
      });
  }, [posts, persistPendingReadIds]);

  const filteredPosts = posts.filter((post) => {
    const textLower = post.raw_text ? post.raw_text.toLowerCase() : "";

    if (hideAds) {
      if (textLower.includes("#реклама") || textLower.includes("erid=") || textLower.includes("реклама. ооо") || textLower.includes("партнерский материал") || textLower.includes("партнерский пост")) return false;
    }

    if (childMode) {
      const badRootsRegex = /(^|[^а-яё])(хуй|хуе|хуя|пизд|ебат|ебан|уеб|бляд|блят|сука|суки|пидор|педик)/i;
      if (badRootsRegex.test(textLower)) return false;
    }

    return true;
  });

  useEffect(() => {
    if (loading || loadingMore || filteredPosts.length > 0 || !hasMore) return;
    loadMore();
  }, [filteredPosts.length, loading, loadingMore, hasMore, loadMore]);

  useEffect(() => {
    const visiblePostIds = new Set(filteredPosts.map((post) => post.id));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const postId = Number((entry.target as HTMLElement).dataset.postId);
          if (!postId) return;

          if (entry.intersectionRatio >= POST_READ_VISIBLE_RATIO) {
            if (markReadTimersRef.current.has(postId)) return;
            const timer = setTimeout(() => {
              markReadTimersRef.current.delete(postId);
              markPostRead(postId);
            }, POST_READ_DELAY_MS);
            markReadTimersRef.current.set(postId, timer);
            return;
          }

          const timer = markReadTimersRef.current.get(postId);
          if (timer) {
            clearTimeout(timer);
            markReadTimersRef.current.delete(postId);
          }
        });
      },
      { threshold: [0, POST_READ_VISIBLE_RATIO, 1] },
    );

    postElementsRef.current.forEach((element, postId) => {
      if (!visiblePostIds.has(postId)) return;
      observer.observe(element);
    });

    return () => {
      observer.disconnect();
      markReadTimersRef.current.forEach((timer) => clearTimeout(timer));
      markReadTimersRef.current.clear();
    };
  }, [filteredPosts, markPostRead]);

  if (error) {
    return (
      <div className="p-8">
        <p className="text-red-400">Ошибка: {error}. Проверьте, что вы авторизованы и backend запущен.</p>
      </div>
    );
  }

  const settingsMenu = (
    <div className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 shadow-xl font-normal">
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

        <div className="absolute invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-all bottom-full pt-2 right-0 md:left-0 md:right-auto md:mb-2 w-48 bg-gray-800 text-white text-xs p-2 rounded shadow-lg pointer-events-none z-50">
          Скрывает из ленты новости, содержащие нецензурную лексику.
        </div>
      </div>

      <div className="flex items-center justify-between group relative">
        <label className="flex items-center gap-2 cursor-pointer text-sm font-medium hover:text-[var(--accent)] transition-colors">
          <input
            type="checkbox"
            checked={collapseCategories}
            onChange={toggleCollapseCategories}
            className="rounded border-[var(--border)] bg-[var(--background)] text-[var(--accent)] focus:ring-[var(--accent)]"
          />
          Свернуть категории
        </label>

        <div className="text-[var(--muted)] hover:text-[var(--foreground)] cursor-help p-1">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>
          </svg>
        </div>

        <div className="absolute invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-all bottom-full pt-2 left-0 mb-2 w-48 bg-gray-800 text-white text-xs p-2 rounded shadow-lg pointer-events-none z-50">
          Оставляет только названия категорий, убирая большие иконки.
        </div>
      </div>

      <div className="flex items-center justify-between group relative">
        <label className="flex items-center gap-2 cursor-pointer text-sm font-medium hover:text-[var(--accent)] transition-colors">
          <input
            type="checkbox"
            checked={onlyNewPosts}
            onChange={toggleOnlyNewPosts}
            className="rounded border-[var(--border)] bg-[var(--background)] text-[var(--accent)] focus:ring-[var(--accent)]"
          />
          Показывать только новое
        </label>

        <div className="text-[var(--muted)] hover:text-[var(--foreground)] cursor-help p-1">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>
          </svg>
        </div>

        <div className="absolute invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-all bottom-full pt-2 left-0 mb-2 w-52 bg-gray-800 text-white text-xs p-2 rounded shadow-lg pointer-events-none z-50">
          Скрывает уже просмотренные посты. Пост считается просмотренным, когда вы его увидели и проскроллили дальше.
        </div>
      </div>
    </div>
  );

  return (
    <div className="px-4 pb-6 pt-14 md:p-6 max-w-3xl mx-auto">
      <header className="relative z-10 w-full mb-2 md:mb-4" ref={settingsRef}>
        <div className="hidden md:flex items-center gap-0.5">
          <h1 className="text-2xl font-bold">Лента</h1>

          <div className="relative z-[100]">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-1 mt-1.5 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
              title="Настройки ленты"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>

          </div>
        </div>

        <p className="hidden md:block text-sm text-[var(--muted)] mb-4 mt-1">Публикации из подключённых источников. Обновляется автоматически.</p>

        {showSettings && (
          <div className="mb-3 md:mb-4 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]/95 shadow-xl backdrop-blur">
              {settingsMenu}
            </div>
          </div>
        )}

        <div className="flex gap-3 overflow-x-auto pl-4 pr-3 pb-3 pt-0 md:pt-3 scrollbar-hide [mask-image:linear-gradient(to_right,transparent,black_16px,black_calc(100%-16px),transparent)] -mx-2">
          {feedCategories.map((c) => {
            const isActive = (c.value === "" && !category) || category === c.value;

            if (collapseCategories) {
              return (
                <button
                  key={c.value || "all"}
                  type="button"
                  onClick={() => setCategory(c.value)}
                  className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap border ${isActive ? "bg-[var(--accent)] text-white border-transparent shadow-md" : "bg-[var(--card)] text-[var(--muted)] border-[var(--border)] hover:text-[var(--foreground)] hover:bg-[var(--card-hover)]"}`}
                >
                  {c.label}
                </button>
              );
            }

            return (
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
          })}
        </div>
      </header>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 rounded-xl bg-[var(--card)] animate-pulse" />
          ))}
        </div>
      ) : onlyNewPosts && filteredPosts.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 text-center text-[var(--muted)]">
          <p className="mb-2">Вы посмотрели все новые посты.</p>
          <p className="text-sm">Чтобы снова увидеть уже просмотренные публикации, отключите настройку ленты «Показывать только новое».</p>
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 text-center text-[var(--muted)]">
          <p className="mb-2">Пока нет публикаций.</p>
          <p className="text-sm">Добавьте каналы в разделе «Источники» и один раз войдите в Telegram на сервере: <code className="bg-[var(--background)] px-1.5 py-0.5 rounded">docker compose -p mylent exec -it backend python -m scripts.telegram_sync</code>. Парсер подтянет посты автоматически.</p>
        </div>
      ) : (
        <>
          <ul className="space-y-4">
            {filteredPosts.map((post) => (
              <li key={post.id} ref={(element) => setPostElement(post.id, element)} data-post-id={post.id}>
                <PostCard
                  post={post}
                  isNew={newPostIds.has(post.id)}
                  onToggleFavorite={(p) => setPosts((prev) => prev.map((x) => x.id === p.id ? { ...x, is_favorite: !x.is_favorite } : x))}
                  onTitleClick={(url) => setPreviewUrl(url)}
                />
              </li>
            ))}
          </ul>
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

      <div
        className={`fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-8 transition-opacity duration-300 ${previewUrl ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setPreviewUrl(null)} />
        <div
          className={`relative w-full max-w-6xl h-full max-h-[90vh] bg-[var(--card)] shadow-2xl rounded-2xl overflow-hidden transition-all duration-300 transform flex flex-col ${previewUrl ? "scale-100 translate-y-0" : "scale-95 translate-y-4"}`}
        >
          <div className="flex items-center justify-between p-3 border-b border-[var(--border)] bg-[var(--background)]">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setPreviewUrl(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--card-hover)] text-[var(--foreground)] transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
              <div className="truncate text-sm font-medium pr-4 text-[var(--muted)]">
                {previewUrl}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={previewUrl || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-xl bg-[var(--accent)] text-white text-xs font-semibold hover:opacity-90 transition-opacity whitespace-nowrap shadow-lg shadow-[var(--accent)]/20"
              >
                РћС‚РєСЂС‹С‚СЊ РѕСЂРёРіРёРЅР°Р» в†—
              </a>
            </div>
          </div>

          <div className="flex-1 bg-white">
            {previewUrl && (
              <iframe
                src={previewUrl}
                className="w-full h-full border-none"
                title="Preview"
                allow="autoplay; encrypted-media; fullscreen"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

