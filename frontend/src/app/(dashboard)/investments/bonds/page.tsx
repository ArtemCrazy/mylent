"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import Link from "next/link";
import { getCategoryDef } from "@/lib/categories";

type Bond = {
  id: number;
  secid: string;
  isin: string;
  name: string;
  shortname: string;
  current_price?: number;
  current_yield?: number;
  rating_ru?: string;
};

type PortfolioItem = {
  id: number;
  quantity: number;
  average_price: number | null;
  bond: Bond;
};

type SignalItem = {
  id: number;
  name?: string;
  condition_type: string;
  target_value: number;
  news_category: string | null;
  cron_minutes: number;
  notify_telegram: boolean;
  unread_count?: number;
  bond: { shortname: string; isin: string; id: number; current_price?: number; current_yield?: number; rating_ru?: string };
};

type SignalGroup = {
  key: string;
  name: string;
  condition_type: string;
  target_value: number | null;
  news_category: string | null;
  cron_minutes: number;
  notify_telegram: boolean;
  bonds: SignalItem["bond"][];
  signals: SignalItem[];
};

export default function InvestmentsPage() {
  const [mainTab, setMainTab] = useState<"portfolio" | "search" | "signals">("portfolio");

  const getAvatarProps = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash) % 360;
    return {
        initial: name.charAt(0).toUpperCase(),
        color: `hsl(${h}, 70%, 50%)`,
        bgColor: `hsl(${h}, 70%, 90%)`,
        darkBgColor: `hsl(${h}, 50%, 20%)`
    };
  };

  const getRatingColor = (rating: string) => {
    const raw = rating.toUpperCase();
    if (raw.includes("AAA") || raw.includes("AA")) return "bg-green-500/10 text-green-500 border-green-500/20";
    if (raw.includes("BBB") || raw === "RUA-" || raw === "RUA" || raw === "RUA+") return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
    if (raw.includes("BB") || raw === "RUB-" || raw === "RUB" || raw === "RUB+") return "bg-orange-500/10 text-orange-500 border-orange-500/20";
    if (raw.includes("C") || raw.includes("D")) return "bg-red-500/10 text-red-500 border-red-500/20";
    return "bg-[var(--card-hover)] text-[var(--muted)] border-[var(--border)]";
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<[string, string, string, string]>>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [signals, setSignals] = useState<SignalItem[]>([]);
  const [sources, setSources] = useState<{ id: number; category: string | null }[]>([]);

  // For editing and bulk signal grouping
  const [selectedBonds, setSelectedBonds] = useState<Set<number>>(new Set());
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<SignalGroup | null>(null);
  const [bulkSignalForm, setBulkSignalForm] = useState<{name: string, condition_type: string, target_value: string, news_category: string, cron_minutes: number, notify_telegram: boolean}>({
    name: "",
    condition_type: "price_less",
    target_value: "",
    news_category: "",
    cron_minutes: 1,
    notify_telegram: true
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showInMenu, setShowInMenu] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setShowInMenu(localStorage.getItem("show_investments_in_menu") === "true");
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleShowInMenu = () => {
    const newValue = !showInMenu;
    setShowInMenu(newValue);
    if (typeof window !== "undefined") {
      localStorage.setItem("show_investments_in_menu", newValue.toString());
      window.dispatchEvent(new Event("investments_menu_toggled"));
    }
  };

  const fetchData = useCallback(async () => {
    try {
      const p = api.investments.portfolio();
      const s = api.sources.list();
      const [data, srcs] = await Promise.all([p, s]);
      setPortfolio((data.portfolio as PortfolioItem[]) || []);
      setSignals((data.signals as SignalItem[]) || []);
      setSources(srcs);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.length > 2) {
        setIsSearching(true);
        try {
          const data = await api.investments.search(searchQuery);
          setSearchResults(data.results || []);
        } catch (e) {
          console.error(e);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const addToPortfolio = async (secid: string, name: string, shortname: string, isin: string) => {
    try {
      await api.investments.addToPortfolio({ secid, isin, name, shortname, quantity: 1, average_price: null });
      fetchData();
      setSearchQuery("");
      setSearchResults([]);
      alert("Добавлено в портфель");
    } catch (e) {
      console.error(e);
      alert("Ошибка при добавлении в портфель");
    }
  };

  const removeFromPortfolio = async (id: number) => {
    if (confirm("Удалить из портфеля?")) {
      await api.investments.removeFromPortfolio(id);
      fetchData();
    }
  };


  const saveGroupSignals = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkSignalForm.target_value && bulkSignalForm.condition_type !== "news_mention") return;
    
    try {
      if (editingGroup) {
         const oldSignalIds = editingGroup.signals.map((s: SignalItem) => s.id);
         if (editingGroup.condition_type !== bulkSignalForm.condition_type) {
            await Promise.all(oldSignalIds.map((id: number) => api.investments.removeSignal(id).catch(()=>{})));
         } else {
            const bondsToDelete = editingGroup.bonds.filter((b: SignalItem["bond"]) => !selectedBonds.has(b.id));
            const signalIdsToDelete = bondsToDelete.map((b: SignalItem["bond"]) => editingGroup.signals.find((s: SignalItem) => s.bond.id === b.id)?.id).filter(Boolean) as number[];
            if (signalIdsToDelete.length) {
               await Promise.all(signalIdsToDelete.map((id: number) => api.investments.removeSignal(id).catch(()=>{})));
            }
         }
      }

      if (selectedBonds.size > 0) {
        await api.investments.addSignalBulk({
          bond_ids: Array.from(selectedBonds),
          condition_type: bulkSignalForm.condition_type,
          target_value: bulkSignalForm.condition_type === "news_mention" ? null : parseFloat(bulkSignalForm.target_value),
          news_category: bulkSignalForm.news_category,
          cron_minutes: bulkSignalForm.cron_minutes,
          notify_telegram: bulkSignalForm.notify_telegram
        });
      }

      fetchData();
      setBulkModalOpen(false);
      setSelectedBonds(new Set());
      setEditingGroup(null);
    } catch (e) {
      console.error(e);
      alert("Ошибка при сохранении сигнала");
    }
  };

  return (
    <div className="p-4 md:p-6 lg:max-w-6xl lg:mx-auto">
      <div className="mb-4">
        <Link href="/investments" className="text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)] transition-colors inline-flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          Назад к выбору актива
        </Link>
      </div>
      <h1 className="text-2xl font-bold mb-6 text-[var(--foreground)]">Облигации</h1>

      {/* Main Tabs and Settings */}
      <div className="flex justify-between items-end border-b border-[var(--border)] mb-6">
        <div className="flex space-x-2 overflow-x-auto">
          <button
            onClick={() => setMainTab("portfolio")}
            className={`pb-3 px-4 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
              mainTab === "portfolio"
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            Мой портфель
          </button>
          <button
            onClick={() => setMainTab("search")}
            className={`pb-3 px-4 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
              mainTab === "search"
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            Поиск активов
          </button>
          <button
            onClick={() => setMainTab("signals")}
            className={`pb-3 px-4 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
              mainTab === "signals"
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            Сигналы ({signals.length})
          </button>
        </div>

        {/* Settings Gear */}
        <div className="relative pb-2" ref={settingsRef}>
          <button 
            onClick={() => setSettingsOpen(!settingsOpen)}
            className="p-1.5 rounded-md text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--card-hover)] transition-colors"
            aria-label="Настройки инвестиций"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </button>

          {settingsOpen && (
            <div className="absolute right-0 top-full mt-1 w-64 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-lg z-10 p-2 animate-fade-in origin-top-right">
              <label className="flex items-center gap-3 p-2 hover:bg-[var(--card-hover)] rounded-lg cursor-pointer transition-colors">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]" 
                  checked={showInMenu}
                  onChange={toggleShowInMenu}
                />
                <span className="text-sm font-medium text-[var(--foreground)]">Отобразить в меню</span>
              </label>
            </div>
          )}
        </div>
      </div>

      {/* PORTFOLIO TAB */}
      {mainTab === "portfolio" && (
        <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-sm overflow-hidden flex flex-col">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[var(--card-hover)] text-[var(--muted)] text-sm border-b border-[var(--border)]">
                    <th className="font-medium p-4 w-[40px]">
                      <input 
                        type="checkbox" 
                        className="rounded border-[var(--border)] text-[var(--accent)] cursor-pointer"
                        onChange={(e) => {
                          if (e.target.checked) setSelectedBonds(new Set(portfolio.map(p => p.bond.id)));
                          else setSelectedBonds(new Set());
                        }}
                        checked={portfolio.length > 0 && selectedBonds.size === portfolio.length}
                      />
                    </th>
                    <th className="font-medium p-4 whitespace-nowrap">Название / ISIN</th>
                    <th className="font-medium p-4 whitespace-nowrap">Кол-во</th>
                    <th className="font-medium p-4 whitespace-nowrap">Цена</th>
                    <th className="font-medium p-4 whitespace-nowrap">Доходность</th>
                    <th className="font-medium p-4 whitespace-nowrap">Рейтинг</th>

                    <th className="font-medium p-4 w-[50px]"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] text-sm">
                  {portfolio.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center p-8 text-[var(--muted)]">
                        Портфель пуст. Перейдите в &quot;Поиск активов&quot;, чтобы добавить облигации.
                      </td>
                    </tr>
                  ) : (
                    portfolio.map((item) => (
                      <tr key={item.id} className="hover:bg-[var(--card-hover)] transition-colors group cursor-pointer" onClick={() => {
                          const newSet = new Set(selectedBonds);
                          if (newSet.has(item.bond.id)) newSet.delete(item.bond.id);
                          else newSet.add(item.bond.id);
                          setSelectedBonds(newSet);
                      }}>
                        <td className="p-4 w-[40px]">
                          <input 
                            type="checkbox" 
                            className="rounded border-[var(--border)] text-[var(--accent)] cursor-pointer pointer-events-none"
                            checked={selectedBonds.has(item.bond.id)}
                            readOnly
                          />
                        </td>
                        <td className="p-4 flex items-center gap-3">
                          {(() => {
                            const avatar = getAvatarProps(item.bond.shortname);
                            return (
                              <div 
                                className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-sm"
                                style={{ backgroundColor: avatar.bgColor, color: avatar.color }}
                              >
                                {avatar.initial}
                              </div>
                            );
                          })()}
                          <div>
                            <p className="font-semibold text-[var(--foreground)]">{item.bond.shortname}</p>
                            <p className="text-xs text-[var(--muted)]">{item.bond.isin}</p>
                          </div>
                        </td>
                        <td className="p-4 px-6 font-medium text-[var(--foreground)]">
                          {item.quantity} шт.
                        </td>
                        <td className="p-4">
                          <span className={`inline-block px-2 py-1 rounded-md bg-[var(--background)] border border-[var(--border)] ${item.bond.current_price ? 'text-[var(--foreground)]' : 'text-[var(--muted)]'}`}>
                            {item.bond.current_price ? `${item.bond.current_price}%` : "—"}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`inline-block px-2 py-1 rounded-md bg-[var(--background)] border border-[var(--border)] ${item.bond.current_yield ? 'text-[var(--foreground)]' : 'text-[var(--muted)]'}`}>
                            {item.bond.current_yield ? `${item.bond.current_yield}%` : "—"}
                          </span>
                        </td>
                        <td className="p-4">
                          {item.bond.rating_ru ? (
                            <span className={`inline-block px-2 py-1 rounded-md border text-xs font-semibold ${getRatingColor(item.bond.rating_ru)}`}>
                              {item.bond.rating_ru}
                            </span>
                          ) : (
                            <span className="text-[var(--muted)] text-sm">—</span>
                          )}
                        </td>

                        <td className="p-4 text-right">
                          <button
                            onClick={() => removeFromPortfolio(item.id)}
                            className="text-[var(--muted)] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-2"
                            title="Удалить из портфеля"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
        </div>
      )}

      {/* SEARCH TAB */}
      {mainTab === "search" && (
        <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-6 shadow-sm">
          <h2 className="text-[var(--foreground)] font-semibold text-lg mb-4">Поиск активов на MOEX</h2>
          
          <div className="relative mb-6">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Введите название облигации или ISIN..."
              className="w-full bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] rounded-lg px-4 py-3 outline-none focus:border-[var(--accent)] transition-colors shadow-sm"
            />
            {isSearching && (
              <div className="absolute right-4 top-3.5 w-5 h-5 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
            )}
          </div>

          <div className="space-y-3">
            {searchResults.map((res: [string, string, string, string], idx: number) => (
              <div key={idx} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 rounded-xl border border-[var(--border)] bg-[var(--background)] hover:border-[var(--accent)] transition-all shadow-sm hover:shadow-md">
                <div className="mb-3 sm:mb-0">
                  <p className="font-semibold text-[var(--foreground)] text-lg mb-1">{res[2] || res[1]}</p>
                  <div className="flex gap-3 text-sm text-[var(--muted)]">
                    <span className="bg-[var(--card-hover)] px-2 py-0.5 rounded font-medium">{res[3]}</span>
                    <span>SECID: {res[0]}</span>
                  </div>
                </div>
                <button
                  onClick={() => addToPortfolio(res[0], res[1], res[2], res[3])}
                  className="bg-[var(--accent)] text-white px-5 py-2 rounded-lg font-semibold hover:opacity-90 transition-opacity shadow-sm"
                >
                  + В портфель
                </button>
              </div>
            ))}
            {searchQuery.length > 2 && searchResults.length === 0 && !isSearching && (
              <div className="text-center p-12 border border-[var(--border)] border-dashed rounded-xl">
                <p className="text-[var(--muted)] text-lg">По запросу «{searchQuery}» ничего не найдено.</p>
                <p className="text-[var(--muted)] text-sm mt-2">Попробуйте ввести ISIN или точное название.</p>
              </div>
            )}
            {searchQuery.length <= 2 && searchResults.length === 0 && (
               <div className="text-center p-12 border border-[var(--border)] border-dashed rounded-xl">
                  <p className="text-[var(--muted)]">Введите не менее 3 символов для поиска</p>
               </div>
            )}
          </div>
        </div>
      )}

      {/* SIGNALS TAB */}
      {mainTab === "signals" && (
        <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-sm overflow-hidden flex flex-col mt-6">
          <div className="p-6 border-b border-[var(--border)] flex justify-between items-center bg-[var(--card)] relative z-10">
            <h2 className="text-[var(--foreground)] font-semibold text-lg">Активные сигналы</h2>
            <button onClick={() => {
              setEditingGroup(null);
              setBulkSignalForm({ name: "", condition_type: "price_less", target_value: "", news_category: "", cron_minutes: 1, notify_telegram: true });
              setSelectedBonds(new Set());
              setBulkModalOpen(true);
            }} className="bg-[var(--accent)] text-white px-5 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity whitespace-nowrap">
              + Добавить сигнал
            </button>
          </div>
          
          {signals.length === 0 ? (
            <div className="text-center p-12">
              <p className="text-[var(--muted)]">У вас пока нет активных сигналов.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-[var(--card-hover)] text-[var(--muted)]">
                  <tr>
                    <th className="px-6 py-4 font-medium first:rounded-tl-lg">Название сигнала</th>
                    <th className="px-6 py-4 font-medium">Периодичность</th>
                    <th className="px-6 py-4 font-medium w-40 text-center">Охват</th>
                    <th className="px-6 py-4 font-medium w-32 text-center">Статус</th>
                    <th className="px-6 py-4 font-medium last:rounded-tr-lg w-24"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] relative border-b border-[var(--border)]">
              {(() => {
                const groups = Object.values(signals.reduce((acc, sig) => {
                  const key = `${sig.name || ""}_${sig.condition_type}_${sig.target_value}_${sig.news_category}_${sig.cron_minutes}_${sig.notify_telegram}`;
                  if (!acc[key]) {
                    acc[key] = {
                      key,
                      name: sig.name || "",
                      condition_type: sig.condition_type,
                      target_value: sig.target_value,
                      news_category: sig.news_category,
                      cron_minutes: sig.cron_minutes,
                      notify_telegram: sig.notify_telegram,
                      bonds: [],
                      signals: []
                    };
                  }
                  if (!acc[key].bonds.find((b: SignalItem["bond"]) => b.id === sig.bond.id)) {
                    acc[key].bonds.push(sig.bond);
                  }
                  acc[key].signals.push(sig);
                  return acc;
                }, {} as Record<string, SignalGroup>));

                return groups.map((group) => {
                  let badgeColor = "bg-[var(--card-hover)]";
                  if (group.condition_type.includes("greater") || group.condition_type.includes("grow")) badgeColor = "bg-green-500/10 text-green-500 border-green-500/20";
                  if (group.condition_type.includes("less") || group.condition_type.includes("drop")) badgeColor = "bg-red-500/10 text-red-500 border-red-500/20";
                  if (group.condition_type === "news_mention") badgeColor = "bg-blue-500/10 text-blue-500 border-blue-500/20";

                  return (
                    <tr key={group.key} className="group hover:bg-[var(--card-hover)] transition-colors cursor-pointer" onClick={() => {
                      setEditingGroup(group);
                      setSelectedBonds(new Set(group.bonds.map((b: SignalItem["bond"]) => b.id)));
                      setBulkSignalForm({
                        name: group.name,
                        condition_type: group.condition_type,
                        target_value: group.target_value ? group.target_value.toString() : "",
                        news_category: group.news_category || "",
                        cron_minutes: group.cron_minutes || 1,
                        notify_telegram: group.notify_telegram !== false
                      });
                      setBulkModalOpen(true);
                    }}>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-[var(--foreground)] truncate max-w-[300px]">
                          {group.name ? group.name : (
                            <>
                              {group.condition_type === "price_less" && `Цена упадет < ${group.target_value}`}
                              {group.condition_type === "price_greater" && `Цена вырастет > ${group.target_value}`}
                              {group.condition_type === "yield_greater" && `Доходность > ${group.target_value}%`}
                              {group.condition_type === "yield_less" && `Доходность < ${group.target_value}%`}
                              {group.condition_type === "price_change_drop_greater" && `Дневное падение > ${group.target_value}%`}
                              {group.condition_type === "price_change_grow_greater" && `Дневной рост > ${group.target_value}%`}
                              {group.condition_type === "news_mention" && (group.news_category ? `Новости (Кат: ${getCategoryDef(group.news_category)?.label || group.news_category})` : "Новости (Любая)")}
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-[var(--muted)]">
                        {group.cron_minutes <= 1 ? "Мгновенно" : `Раз в ${group.cron_minutes} мин`}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="font-medium text-[var(--foreground)]">{group.bonds.length} шт.</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                         <div className={`inline-flex items-center px-2 py-0.5 text-[11px] uppercase tracking-wider font-bold rounded border ${badgeColor}`}>
                             {group.signals.reduce((acc: number, s: SignalItem) => acc + (s.unread_count || 0), 0) > 0 ? (
                               <span className="flex items-center gap-1.5">
                                 <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-[pulse_1s_ease-in-out_infinite] shadow-[0_0_8px_rgba(239,68,68,0.6)]"></div> 
                                 Активен
                               </span>
                             ) : "Мониторинг"}
                         </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                         <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                           <button 
                             onClick={(e) => {
                               e.stopPropagation();
                               setEditingGroup(group);
                               setSelectedBonds(new Set(group.bonds.map((b: SignalItem["bond"]) => b.id)));
                               setBulkSignalForm({
                                 name: group.name,
                                 condition_type: group.condition_type,
                                 target_value: group.target_value ? group.target_value.toString() : "",
                                 news_category: group.news_category || "",
                                 cron_minutes: group.cron_minutes || 1,
                                 notify_telegram: group.notify_telegram !== false
                               });
                               setBulkModalOpen(true);
                             }}
                             title="Настроить"
                             className="p-1.5 text-[var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--background)] rounded-lg transition-colors border border-transparent hover:border-[var(--accent)]/20"
                           >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                           </button>
                           <button 
                             onClick={async (e) => {
                               e.stopPropagation();
                               if (confirm('Удалить отслеживание этого сигнала для всех выбранных бумаг?')) {
                                 const ids = group.signals.map((s: SignalItem) => s.id);
                                 await Promise.all(ids.map((id: number) => api.investments.removeSignal(id).catch(()=>{})));
                                 fetchData();
                               }
                             }}
                             title="Удалить"
                             className="p-1.5 text-[var(--muted)] hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors border border-transparent hover:border-red-500/20"
                           >
                             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                           </button>
                         </div>
                      </td>
                    </tr>
                  );
                });
              })()}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* STICKY BULK ACTION BAR */}
      {selectedBonds.size > 0 && mainTab !== "search" && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[var(--card)] border border-[var(--border)] shadow-2xl rounded-full p-2 px-6 flex items-center gap-6 z-40 animate-fade-in shadow-black/20">
          <span className="font-medium text-[var(--foreground)] pl-2">Выбрано {selectedBonds.size}</span>
          <div className="w-px h-6 bg-[var(--border)]"></div>
          <button onClick={() => setBulkModalOpen(true)} className="bg-[var(--accent)] text-white px-5 py-2 rounded-full font-semibold hover:opacity-90 shadow-sm transition-opacity">
            Настроить ({selectedBonds.size})
          </button>
          
        </div>
      )}

      {/* UNIFIED SIGNAL MODAL */}
      {bulkModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-2xl shadow-black/40 w-full max-w-xl overflow-hidden animate-fade-in flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-[var(--border)] flex justify-between items-center shrink-0 bg-[var(--card)]/80 backdrop-blur-md">
              <div className="flex items-center gap-3">
                 <div className="p-2 bg-[var(--accent)]/10 rounded-xl text-[var(--accent)]">
                   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20"/><path d="m17 5-5-3-5 3"/><path d="m17 19-5 3-5-3"/><path d="M2 12h20"/><path d="m5 7-3 5 3 5"/><path d="m19 7 3 5-3 5"/></svg>
                 </div>
                 <h3 className="font-bold text-xl text-[var(--foreground)]">{editingGroup ? 'Настройка сигнала' : 'Новый сигнал'}</h3>
              </div>
              <button type="button" onClick={() => { setBulkModalOpen(false); setEditingGroup(null); }} className="text-[var(--muted)] hover:text-red-400 hover:bg-red-400/10 transition-colors w-8 h-8 flex flex-col items-center justify-center rounded-full">✕</button>
            </div>
            
            <form onSubmit={saveGroupSignals} className="overflow-y-auto custom-scrollbar flex-1 flex flex-col pb-0">
               <div className="p-6 space-y-6 flex-1">
              <div>
                <label className="block text-xs uppercase tracking-wider font-bold text-[var(--muted)] mb-2 ml-1">Понятное название (Опционально)</label>
                <input
                  type="text"
                  placeholder="Например: Покупка ОФЗ на дне"
                  className="w-full bg-[var(--card-hover)] border border-transparent text-[var(--foreground)] rounded-xl px-4 py-3.5 outline-none focus:border-[var(--accent)] focus:bg-[var(--background)] transition-all text-sm placeholder:text-[var(--muted)]/50"
                  value={bulkSignalForm.name || ""}
                  onChange={e => setBulkSignalForm({...bulkSignalForm, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider font-bold text-[var(--muted)] mb-2 ml-1">Событие-триггер</label>
                <select
                  className="w-full bg-[var(--card-hover)] border border-transparent text-[var(--foreground)] rounded-xl px-4 py-3.5 outline-none focus:border-[var(--accent)] focus:bg-[var(--background)] transition-all text-sm appearance-none font-medium cursor-pointer"
                  value={bulkSignalForm.condition_type}
                  onChange={e => setBulkSignalForm({...bulkSignalForm, condition_type: e.target.value})}
                >
                  <option value="price_less">📉 Цена упадет ниже указанной</option>
                  <option value="price_greater">📈 Цена вырастет выше указанной</option>
                  <option value="yield_less">🔻 Доходность станет меньше</option>
                  <option value="yield_greater">🚀 Доходность станет больше</option>
                  <option value="price_change_drop_greater">⚠️ Дневное падение &gt; %</option>
                  <option value="price_change_grow_greater">Взрывной рост &gt; % за день</option>
                  <option value="news_mention">📰 Упоминание в новостях парсера</option>
                </select>
              </div>
              
              {bulkSignalForm.condition_type !== "news_mention" && (
                <div className="animate-fade-in p-4 bg-[var(--accent)]/5 rounded-xl border border-[var(--accent)]/10">
                  <label className="block text-xs tracking-wider uppercase font-bold text-[var(--accent)] mb-3">Целевое значение</label>
                  <div className="flex items-center">
                    <input
                      type="number" step="0.01" required
                      className="flex-1 bg-[var(--background)] border border-[var(--accent)]/20 text-[var(--foreground)] rounded-l-xl px-4 py-3 outline-none focus:border-[var(--accent)] transition-all font-semibold font-mono text-lg placeholder:text-[var(--muted)]/30"
                      placeholder="0.00"
                      value={bulkSignalForm.target_value}
                      onChange={e => setBulkSignalForm({...bulkSignalForm, target_value: e.target.value})}
                    />
                    <div className="bg-[var(--accent)] text-white px-4 py-3.5 rounded-r-xl font-bold border border-[var(--accent)]">
                      {bulkSignalForm.condition_type.includes("price_change") ? "%" : (bulkSignalForm.condition_type.includes("yield") ? "%" : "₽")}
                    </div>
                  </div>
                  <p className="text-[11px] text-[var(--muted)] mt-2 italic">* При установке значения для нескольких бумаг, убедитесь что этот уровень актуален для каждой из них.</p>
                </div>
              )}

              {bulkSignalForm.condition_type === "news_mention" && (
                <div className="animate-fade-in space-y-4 p-4 bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-sm">
                  <div>
                    <label className="block text-xs uppercase tracking-wider font-bold text-[var(--muted)] mb-2 ml-1">Категория (Тег парсера)</label>
                    <select
                      className="w-full bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] rounded-lg px-3 py-2.5 outline-none focus:border-[var(--accent)] transition-all text-sm font-medium"
                      value={bulkSignalForm.news_category}
                      onChange={e => setBulkSignalForm({...bulkSignalForm, news_category: e.target.value})}
                    >
                      <option value="">Все категории (Любая новость)</option>
                      {Array.from(new Set(sources.map(s => s.category).filter(Boolean))).map(cat => {
                        const label = getCategoryDef(cat as string)?.label || cat;
                        return <option key={cat as string} value={cat as string}>{label}</option>
                      })}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wider font-bold text-[var(--muted)] mb-2 ml-1">Частота проверок</label>
                    <select
                      className="w-full bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] rounded-lg px-3 py-2.5 outline-none focus:border-[var(--accent)] transition-all text-sm font-medium"
                      value={bulkSignalForm.cron_minutes}
                      onChange={e => setBulkSignalForm({...bulkSignalForm, cron_minutes: Number(e.target.value)})}
                    >
                      <option value="1">⚡ Мгновенно (Сразу после выхода)</option>
                      <option value="15">⏱ Каждые 15 минут</option>
                      <option value="60">🕰 Каждый час</option>
                      <option value="360">🌅 Раз в 6 часов</option>
                      <option value="1440">📅 Раз в день</option>
                    </select>
                  </div>
                </div>
              )}
              
              <div className="pt-5 mt-2 border-t border-[var(--border)]">
                <div className="flex items-center justify-between mb-4">
                  <label className="block text-[var(--foreground)] font-bold text-sm tracking-wide">
                    Охват бумаг ({selectedBonds.size})
                  </label>
                  <button type="button" onClick={() => setSelectedBonds(new Set(portfolio.map(p => p.bond.id)))} className="text-xs px-3 py-1 bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20 rounded-full font-bold transition-colors">
                    Выбрать всё
                  </button>
                </div>
                <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
                  {portfolio.length === 0 ? (
                    <div className="p-6 text-center border-2 border-dashed border-[var(--border)] rounded-xl">
                      <p className="text-sm text-[var(--muted)] font-medium">Ваш портфель пуст.</p>
                      <p className="text-xs text-[var(--muted)] mt-1">Перейдите в поиск и добавьте бумаги для применения сигнала.</p>
                    </div>
                  ) : portfolio.map(p => {
                    const isChecked = selectedBonds.has(p.bond.id);
                    return (
                      <label key={p.bond.id} className={`group relative flex items-center justify-between p-3.5 rounded-xl transition-all cursor-pointer border ${isChecked ? 'border-[var(--accent)] bg-[var(--accent)]/5 shadow-sm' : 'border-transparent bg-[var(--card-hover)] hover:bg-[var(--card)] hover:border-[var(--border)] hover:shadow-sm'}`}>
                        <div className="flex items-center gap-4 custom-control">
                          <input 
                            type="checkbox" 
                            className="w-5 h-5 rounded border border-[var(--border)] text-[var(--accent)] shrink-0 focus:ring-0 checked:bg-[var(--accent)] bg-[var(--background)] transition-all cursor-pointer" 
                            checked={isChecked} 
                            onChange={(e) => {
                              const newSet = new Set(selectedBonds);
                              if (e.target.checked) newSet.add(p.bond.id);
                              else newSet.delete(p.bond.id);
                              setSelectedBonds(newSet);
                            }} 
                          />
                          <div className="flex flex-col">
                            <span className={`font-semibold text-sm transition-colors ${isChecked ? 'text-[var(--accent)]' : 'text-[var(--foreground)]'}`}>{p.bond.shortname}</span>
                            <span className="text-[11px] text-[var(--muted)] font-medium mt-0.5">{p.bond.isin}</span>
                          </div>
                        </div>
                        {bulkSignalForm.condition_type !== "news_mention" && p.bond.current_price && (
                           <div className="text-right">
                             <div className="text-[10px] text-[var(--muted)] uppercase tracking-wider font-bold mb-0.5">Акт. цена</div>
                             <div className="text-xs font-mono font-bold text-[var(--foreground)] bg-[var(--background)] px-2 py-0.5 rounded border border-[var(--border)]">{p.bond.current_price}%</div>
                           </div>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
              </div>
              
              <div className="p-6 bg-[var(--card)] border-t border-[var(--border)] flex justify-end shrink-0">
                <button
                  type="submit"
                  disabled={selectedBonds.size === 0}
                  className="w-full bg-[var(--accent)] text-white px-6 py-3.5 rounded-xl font-bold shadow-md shadow-[var(--accent)]/20 hover:shadow-lg hover:shadow-[var(--accent)]/30 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none transition-all flex items-center justify-center gap-2"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                  {editingGroup ? 'Сохранить изменения' : `Запустить сигнал (${selectedBonds.size})`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
