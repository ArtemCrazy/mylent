"use client";

import { useEffect, useRef, useState } from "react";
import { api, type Source } from "@/lib/api";
import { CATEGORY_DEFS, getCategoryDef, CATEGORY_ORDER } from "@/lib/categories";

function formatDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString("ru", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function getCategoryLabel(cat: string | null): string {
  return getCategoryDef(cat)?.label ?? (cat ? cat : "Другое");
}

function getSourceAvatar(configJson: string | null): string | null {
  if (!configJson) return null;
  try {
    const c = JSON.parse(configJson) as { avatar_base64?: string };
    return c.avatar_base64 || null;
  } catch {
    return null;
  }
}

function slugFromTitle(title: string): string {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zа-яё0-9-]/gi, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "source";
  return base.slice(0, 80);
}

function CategorySelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) setSearchQuery("");
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setIsOpen(false);
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const selected = CATEGORY_DEFS.find((c) => c.value === value) ?? CATEGORY_DEFS.find((c) => c.value === "other")!;
  const filtered = searchQuery.trim()
    ? CATEGORY_DEFS.filter((c) => c.label.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : CATEGORY_DEFS;

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-left flex items-center gap-2 text-[var(--foreground)] hover:bg-[var(--card-hover)]"
      >
        <span className={`w-8 h-8 rounded-lg bg-gradient-to-br ${selected.gradient} flex items-center justify-center text-sm shrink-0`}>
          {selected.icon}
        </span>
        <span className="truncate">{selected.label}</span>
        <span className="ml-auto text-[var(--muted)]">▼</span>
      </button>
      {isOpen && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-lg overflow-hidden">
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder="Найти категорию по названию..."
            className="w-full px-3 py-2 border-b border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted)]"
          />
          <ul className="max-h-60 overflow-y-auto">
            {filtered.length === 0 ? (
              <li className="px-3 py-4 text-sm text-[var(--muted)]">Ничего не найдено</li>
            ) : (
              filtered.map((c) => (
                <li key={c.value}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(c.value);
                      setIsOpen(false);
                    }}
                    className={`w-full px-3 py-2 flex items-center gap-2 hover:bg-[var(--card-hover)] text-left ${c.value === value ? "bg-[var(--card-hover)]" : ""}`}
                  >
                    <span className={`w-8 h-8 rounded-lg bg-gradient-to-br ${c.gradient} flex items-center justify-center text-sm shrink-0`}>
                      {c.icon}
                    </span>
                    <span>{c.label}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

const PREDEFINED_SITES = [
  { title: "РИА Новости", slug: "ria", category: "news", url: "https://ria.ru/", rss_url: "https://ria.ru/export/rss2/index.xml", icon: "📰" },
  { title: "РБК", slug: "rbc", category: "news", url: "https://www.rbc.ru/", rss_url: "https://rssexport.rbc.ru/rbcnews/news/30/full.rss", icon: "📊" },
  { title: "Lenta.ru", slug: "lenta", category: "news", url: "https://lenta.ru/", rss_url: "https://lenta.ru/rss/news", icon: "🗞️" },
  { title: "ТАСС", slug: "tass", category: "news", url: "https://tass.ru/", rss_url: "https://tass.ru/feed", icon: "🌐" },
  { title: "Ведомости", slug: "vedomosti", category: "news", url: "https://www.vedomosti.ru/", rss_url: "https://www.vedomosti.ru/info/rss", icon: "📈" },
];

export default function SourcesPage() {
  const [tab, setTab] = useState<"telegram" | "sites">("telegram");
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [title, setTitle] = useState("");
  const [channel, setChannel] = useState("");
  const [category, setCategory] = useState<string>("other");
  const [showInFeed, setShowInFeed] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editShowInFeed, setEditShowInFeed] = useState(true);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [addingSiteSlug, setAddingSiteSlug] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [hasPublicLink, setHasPublicLink] = useState<boolean | null>(null);
  const [avatarLoading, setAvatarLoading] = useState(false);

  const loadSources = () => {
    api.sources.list().then(setSources).catch((e) => setError(e.message)).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSources();
  }, []);

  const channelForPreview = channel.trim().replace(/^@/, "").replace(/^https?:\/\/t\.me\//, "").split("/")[0].split("?")[0];
  useEffect(() => {
    if (!channelForPreview || channelForPreview.length < 3) {
      setAvatarPreview(null);
      setHasPublicLink(null);
      return;
    }
    const t = setTimeout(() => {
      setAvatarLoading(true);
      api.sources
        .channelPreview(channelForPreview)
        .then((r) => {
          setAvatarPreview(r.avatar_base64 || null);
          setHasPublicLink(r.has_public_link ?? true);
        })
        .catch(() => {
          setAvatarPreview(null);
          setHasPublicLink(null);
        })
        .finally(() => setAvatarLoading(false));
    }, 600);
    return () => clearTimeout(t);
  }, [channelForPreview]);

  async function handleAddSource(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    const t = title.trim();
    const ch = channel.trim().replace(/^@/, "").replace(/^https?:\/\/t\.me\//, "");
    if (!t) {
      setFormError("Введите название");
      return;
    }
    if (!ch) {
      setFormError("Введите username канала (например @channel или t.me/channel)");
      return;
    }
    if (hasPublicLink === false) {
      setFormError("У этого канала нет публичной ссылки (только приглашение). Добавлять можно только каналы с публичным username.");
      return;
    }
    setSubmitting(true);
    try {
      const slug = slugFromTitle(t) + "-" + ch.toLowerCase().replace(/[^a-z0-9]/g, "");
      await api.sources.create({
        type: "telegram",
        title: t,
        slug: slug.slice(0, 255),
        category: category || "other",
        url: `https://t.me/${ch}`,
        config_json: JSON.stringify({ channel_username: ch, avatar_base64: avatarPreview || undefined }),
        show_in_feed: showInFeed,
      });
      setTitle("");
      setChannel("");
      setCategory("other");
      setShowInFeed(true);
      setAvatarPreview(null);
      setHasPublicLink(null);
      setShowForm(false);
      loadSources();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Ошибка добавления");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(s: Source) {
    setTogglingId(s.id);
    try {
      await api.sources.update(s.id, { is_active: !s.is_active });
      loadSources();
    } catch {
      // ignore
    } finally {
      setTogglingId(null);
    }
  }

  async function handleAddSite(site: typeof PREDEFINED_SITES[0]) {
    setAddingSiteSlug(site.slug);
    try {
      await api.sources.create({
        type: "rss",
        title: site.title,
        slug: site.slug,
        category: site.category,
        url: site.url,
        config_json: JSON.stringify({ rss_url: site.rss_url }),
        show_in_feed: true,
      });
      loadSources();
    } catch (err) {
      alert("Ошибка добавления: " + (err instanceof Error ? err.message : ""));
    } finally {
      setAddingSiteSlug(null);
    }
  }

  function startEdit(s: Source) {
    setEditingId(s.id);
    setEditTitle(s.title);
    setEditCategory(s.category || "other");
    setEditShowInFeed(s.show_in_feed ?? true);
  }

  async function handleSaveEdit() {
    if (!editingId) return;
    try {
      await api.sources.update(editingId, { title: editTitle.trim(), category: editCategory, show_in_feed: editShowInFeed });
      setEditingId(null);
      loadSources();
    } catch {
      // ignore
    }
  }

  async function handleDelete(s: Source, onDeleted?: () => void) {
    if (!confirm(`Удалить источник «${s.title}» и все его посты?`)) return;
    try {
      await api.sources.delete(s.id);
      onDeleted?.();
      loadSources();
    } catch (err) {
      alert("Не удалось удалить: " + (err instanceof Error ? err.message : "неизвестная ошибка"));
    }
  }

  if (error) {
    return (
      <div className="p-8">
        <p className="text-red-400">Ошибка: {error}</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <header className="mb-6">
        <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
          <div>
            <h1 className="text-2xl font-semibold">Источники</h1>
            <p className="text-sm text-[var(--muted)]">Подключённые каналы и новостные ленты.</p>
          </div>
          {tab === "telegram" && (
            <button
              type="button"
              onClick={() => setShowForm(!showForm)}
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              {showForm ? "Отмена" : "+ Добавить источник"}
            </button>
          )}
        </div>
        
        <div className="flex gap-1 border-b border-[var(--border)]">
          <button 
            type="button" 
            onClick={() => setTab("telegram")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "telegram" ? "border-[var(--accent)] text-[var(--foreground)]" : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"}`}
          >
            Telegram
          </button>
          <button 
            type="button" 
            onClick={() => setTab("sites")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "sites" ? "border-[var(--accent)] text-[var(--foreground)]" : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"}`}
          >
            Сайты (RSS)
          </button>
        </div>
      </header>

      {tab === "telegram" && showForm && (
        <form onSubmit={handleAddSource} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 mb-6 space-y-4">
          <h2 className="font-medium">Telegram-канал</h2>
          <div>
            <label className="block text-sm text-[var(--muted)] mb-1">Название (как показывать в ленте)</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Например: Новости AI"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)]"
            />
          </div>
          <div>
            <label className="block text-sm text-[var(--muted)] mb-1">Категория</label>
            <CategorySelect value={category} onChange={setCategory} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showInFeed}
              onChange={(e) => setShowInFeed(e.target.checked)}
              className="w-4 h-4 accent-[var(--accent)]"
            />
            <span className="text-sm text-[var(--foreground)]">Выводить в ленте</span>
            <span className="text-xs text-[var(--muted)]">(если снять — посты парсятся, но не показываются)</span>
          </label>
          <div className="flex gap-4 items-start">
            <div className="shrink-0 w-14 h-14 rounded-full bg-[var(--card-hover)] overflow-hidden flex items-center justify-center text-[var(--muted)] text-2xl">
              {avatarLoading ? (
                <span className="animate-pulse">…</span>
              ) : avatarPreview ? (
                <img src={`data:image/jpeg;base64,${avatarPreview}`} alt="" className="w-full h-full object-cover" />
              ) : (
                <span>@</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <label className="block text-sm text-[var(--muted)] mb-1">Канал (@username или ссылка t.me/...)</label>
              <input
                type="text"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                placeholder="@channel или https://t.me/channel"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)]"
              />
            </div>
          </div>
          {hasPublicLink === false && channelForPreview.length >= 3 && (
            <p className="text-sm text-amber-500">
              У этого канала нет публичной ссылки (только приглашение). Такие каналы добавлять нельзя — парсить не получится.
            </p>
          )}
          {formError && <p className="text-sm text-red-400">{formError}</p>}
          <button
            type="submit"
            disabled={submitting || hasPublicLink === false}
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Добавляю…" : "Добавить"}
          </button>
        </form>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-[var(--card)] animate-pulse" />
          ))}
        </div>
      ) : tab === "sites" ? (
        <div className="space-y-6">
          <section>
            <h2 className="text-sm font-medium text-[var(--muted)] mb-3 uppercase tracking-wide">
              Каталог сайтов
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PREDEFINED_SITES.map((site) => {
                const addedSource = sources.find((s) => s.slug === site.slug);
                return (
                  <div key={site.slug} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 flex gap-3 items-center">
                    <div className="w-10 h-10 shrink-0 rounded-full bg-[var(--card-hover)] flex items-center justify-center text-xl shadow-sm border border-[var(--border)]">
                      {site.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{site.title}</div>
                      <a href={site.url} target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--muted)] truncate hover:text-[var(--accent)]">
                        {site.url.replace(/^https?:\/\//, '')}
                      </a>
                    </div>
                    {addedSource ? (
                      <button
                        title="Удалить"
                        type="button"
                        onClick={() => handleDelete(addedSource)}
                        className="shrink-0 px-2.5 py-1 text-xs font-medium rounded-md bg-green-500/10 text-green-500 hover:bg-red-500/10 hover:text-red-500 transition-colors"
                      >
                        ✓ Добавлено
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={addingSiteSlug === site.slug}
                        onClick={() => handleAddSite(site)}
                        className="shrink-0 px-2.5 py-1 text-xs font-medium rounded-md bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50"
                      >
                        {addingSiteSlug === site.slug ? "..." : "Добавить"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="mt-4 text-xs text-[var(--muted)]">Новостные ленты RSS скачиваются и проверяются бекендом раз в 10 минут (вместе с Telegram постами).</p>
          </section>
          
          {sources.filter(s => s.type === "rss").length > 0 && (
            <section className="pt-4 border-t border-[var(--border)]">
              <h2 className="text-sm font-medium text-[var(--muted)] mb-3 uppercase tracking-wide">
                Подключённые ленты
              </h2>
              <ul className="space-y-3">
                {sources.filter(s => s.type === "rss").map((s) => (
                  <li
                    key={s.id}
                    className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 pt-4 pb-4 pr-6 flex items-start gap-4"
                  >
                    <div className="w-12 h-12 shrink-0 rounded-full bg-[var(--card-hover)] overflow-hidden flex items-center justify-center text-[var(--muted)] text-lg">
                      {PREDEFINED_SITES.find(ps => ps.slug === s.slug)?.icon || "🌐"}
                    </div>
                    <div className="min-w-0 flex-1 pr-4">
                      {editingId === s.id ? (
                        <div className="space-y-3">
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)] font-medium"
                            placeholder="Название"
                          />
                          <div>
                            <span className="block text-xs text-[var(--muted)] mb-1">Категория</span>
                            <CategorySelect value={editCategory} onChange={setEditCategory} />
                          </div>
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={editShowInFeed}
                              onChange={(e) => setEditShowInFeed(e.target.checked)}
                              className="w-4 h-4 accent-[var(--accent)]"
                            />
                            <span className="text-sm text-[var(--foreground)]">Выводить в ленте</span>
                          </label>
                          <div className="flex gap-2 flex-wrap items-center">
                            <button
                              type="button"
                              onClick={handleSaveEdit}
                              className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm text-white hover:opacity-90"
                            >
                              Сохранить
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--muted)] hover:bg-[var(--card-hover)]"
                            >
                              Отмена
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <span className="font-medium">{s.title}</span>
                          <span className="text-xs text-[var(--muted)] ml-2">({getCategoryLabel(s.category)})</span>
                          {!s.show_in_feed && (
                            <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500">скрыт из ленты</span>
                          )}
                          {s.url && (
                            <a href={s.url} target="_blank" rel="noopener noreferrer" className="block text-sm text-[var(--accent)] hover:underline mt-0.5">
                              {s.url}
                            </a>
                          )}
                          <p className="text-sm text-[var(--muted)] mt-1">Синхронизация: {formatDate(s.last_synced_at)}</p>
                        </>
                      )}
                    </div>
                    {editingId !== s.id && (
                      <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end min-w-[140px]">
                        <button
                          type="button"
                          onClick={() => startEdit(s)}
                          className="text-xs text-[var(--accent)] hover:underline"
                        >
                          Редактировать
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleActive(s)}
                          disabled={togglingId === s.id}
                          className={`text-xs px-2 py-1 rounded ${s.is_active ? "bg-green-500/20 text-green-400 hover:bg-green-500/30" : "bg-[var(--card-hover)] text-[var(--muted)] hover:bg-[var(--border)]"}`}
                        >
                          {togglingId === s.id ? "…" : s.is_active ? "Вкл" : "Выкл"}
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      ) : sources.filter(s => s.type === "telegram").length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 text-center text-[var(--muted)]">
          <p className="mb-2">Пока нет источников.</p>
          <p className="text-sm">Нажмите «Добавить источник» выше и укажите Telegram-канал.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {CATEGORY_ORDER.map((catKey) => {
            const items = sources.filter((s) => s.type === "telegram" && (s.category || "other") === catKey);
            if (items.length === 0) return null;
            return (
              <section key={catKey}>
                <h2 className="text-sm font-medium text-[var(--muted)] mb-2 uppercase tracking-wide">
                  {getCategoryLabel(catKey)}
                </h2>
                <ul className="space-y-3">
                  {items.map((s) => (
                    <li
                      key={s.id}
                      className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 pt-4 pb-4 pr-6 flex items-start gap-4"
                    >
                      <div className="w-12 h-12 shrink-0 rounded-full bg-[var(--card-hover)] overflow-hidden flex items-center justify-center text-[var(--muted)] text-lg">
                        {(() => {
                          const avatar = getSourceAvatar(s.config_json ?? null);
                          return avatar ? (
                            <img src={`data:image/jpeg;base64,${avatar}`} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span>@</span>
                          );
                        })()}
                      </div>
                      <div className="min-w-0 flex-1 pr-4">
                        {editingId === s.id ? (
                          <div className="space-y-3">
                            <input
                              type="text"
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)] font-medium"
                              placeholder="Название"
                            />
                            <div>
                              <span className="block text-xs text-[var(--muted)] mb-1">Категория</span>
                              <CategorySelect value={editCategory} onChange={setEditCategory} />
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={editShowInFeed}
                                onChange={(e) => setEditShowInFeed(e.target.checked)}
                                className="w-4 h-4 accent-[var(--accent)]"
                              />
                              <span className="text-sm text-[var(--foreground)]">Выводить в ленте</span>
                            </label>
                            <div className="flex gap-2 flex-wrap items-center">
                              <button
                                type="button"
                                onClick={handleSaveEdit}
                                className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm text-white hover:opacity-90"
                              >
                                Сохранить
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--muted)] hover:bg-[var(--card-hover)]"
                              >
                                Отмена
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(s, () => setEditingId(null))}
                                className="rounded-lg px-3 py-1.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10"
                              >
                                Удалить
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <span className="font-medium">{s.title}</span>
                            <span className="text-xs text-[var(--muted)] ml-2">({s.type})</span>
                            {!s.show_in_feed && (
                              <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500">скрыт из ленты</span>
                            )}
                            {s.url && (
                              <a href={s.url} target="_blank" rel="noopener noreferrer" className="block text-sm text-[var(--accent)] hover:underline mt-0.5">
                                {s.url}
                              </a>
                            )}
                            <p className="text-sm text-[var(--muted)] mt-1">Синхронизация: {formatDate(s.last_synced_at)}</p>
                          </>
                        )}
                      </div>
                      {editingId !== s.id && (
                        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end min-w-[140px]">
                          <button
                            type="button"
                            onClick={() => startEdit(s)}
                            className="text-xs text-[var(--accent)] hover:underline"
                          >
                            Редактировать
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleActive(s)}
                            disabled={togglingId === s.id}
                            className={`text-xs px-2 py-1 rounded ${s.is_active ? "bg-green-500/20 text-green-400 hover:bg-green-500/30" : "bg-[var(--card-hover)] text-[var(--muted)] hover:bg-[var(--border)]"}`}
                          >
                            {togglingId === s.id ? "…" : s.is_active ? "Вкл" : "Выкл"}
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
