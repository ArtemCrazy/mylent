"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, type Post } from "@/lib/api";
import { PostCard } from "@/components/PostCard";
import { CATEGORY_DEFS, type CategoryDef } from "@/lib/categories";

const ALL_ITEM: CategoryDef = { value: "", label: "Все", icon: "◆", gradient: "from-gray-600 to-gray-800" };

const PAGE_SIZE = 10;
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

  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const dragRef = useRef(false);

  const [showSettings, setShowSettings] = useState(false);
  const [hideAds, setHideAds] = useState(false);
  const [childMode, setChildMode] = useState(false);
  const [collapseCategories, setCollapseCategories] = useState(false);

  useEffect(() => {
    setHideAds(localStorage.getItem("hideAds") === "true");
    setChildMode(localStorage.getItem("childMode") === "true");
    setCollapseCategories(localStorage.getItem("collapseCategories") === "true");
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

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    setIsDragging(true);
    dragRef.current = false;
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
  };

  const handleMouseLeave = () => setIsDragging(false);
  const handleMouseUp = () => setIsDragging(false);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 2;
    if (Math.abs(walk) > 5) {
      dragRef.current = true;
    }
    scrollRef.current.scrollLeft = scrollLeft - walk;
  };

  const handleCategoryClick = (val: string) => {
    if (dragRef.current) return;
    setCategory(val);
  };

  if (error) {
    return (
      <div className="p-8">
        <p className="text-red-400">Ошибка: {error}. Проверьте, что вы авторизованы и backend запущен.</p>
      </div>
    );
  }

  return (
    <div className="px-4 pb-6 md:p-6 max-w-3xl mx-auto">
      <header className="mb-4 relative z-10 w-full">
        <div className="flex items-center gap-0.5">
          <h1 className="text-2xl font-bold">Лента</h1>
          
          <div className="relative z-[100]" ref={settingsRef}>
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
            
            {showSettings && (
              <div className="absolute left-0 top-8 w-64 bg-[var(--card)] border border-[var(--border)] shadow-xl rounded-xl p-3 z-50 animate-in fade-in slide-in-from-top-2 flex flex-col gap-3 font-normal">
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
              </div>
            )}
          </div>
        </div>
        
        <p className="text-sm text-[var(--muted)] mb-4 mt-1">Публикации из подключённых источников. Обновляется автоматически.</p>

        <div 
          ref={scrollRef}
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          className={`cursor-grab active:cursor-grabbing flex gap-3 overflow-x-auto max-w-full pb-3 scrollbar-hide pt-[6rem] md:pt-3 -mx-2 px-2 [mask-image:linear-gradient(to_right,black_calc(100%-2rem),transparent)]`}
        >
          {feedCategories.map((c) => {
            const isActive = (c.value === "" && !category) || category === c.value;
            
            if (collapseCategories) {
              return (
                <button
                  key={c.value || "all"}
                  type="button"
                  onClick={() => handleCategoryClick(c.value)}
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
                onClick={() => handleCategoryClick(c.value)}
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
    </div>
  );
}
