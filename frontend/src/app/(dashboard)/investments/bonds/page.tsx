"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import Link from "next/link";

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
  condition_type: string;
  target_value: number;
  bond: { shortname: string; isin: string; id: number };
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

  // For inline signal creation in portfolio table
  const [addingSignalFor, setAddingSignalFor] = useState<number | null>(null);
  const [signalForm, setSignalForm] = useState<{condition_type: string, target_value: string}>({
    condition_type: "price_less",
    target_value: "",
  });

  // For bulk signal creation
  const [selectedBonds, setSelectedBonds] = useState<Set<number>>(new Set());
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkSignalForm, setBulkSignalForm] = useState<{condition_type: string, target_value: string}>({
    condition_type: "price_less",
    target_value: "",
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
      const data = await api.investments.portfolio();
      setPortfolio((data.portfolio as PortfolioItem[]) || []);
      setSignals((data.signals as SignalItem[]) || []);
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

  const addSignal = async (e: React.FormEvent, bondId: number) => {
    e.preventDefault();
    if (!signalForm.target_value && signalForm.condition_type !== "news_mention") return;

    try {
      await api.investments.addSignal({
          bond_id: bondId,
          condition_type: signalForm.condition_type,
          target_value: signalForm.condition_type === "news_mention" ? 0 : parseFloat(signalForm.target_value)
      });
      fetchData();
      setAddingSignalFor(null);
      setSignalForm({ condition_type: "price_less", target_value: "" });
    } catch (error) {
      console.error(error);
      alert("Ошибка при добавлении сигнала");
    }
  };

  const addBulkSignals = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkSignalForm.target_value && bulkSignalForm.condition_type !== "news_mention") return;
    
    try {
      await api.investments.addSignalBulk({
        bond_ids: Array.from(selectedBonds),
        condition_type: bulkSignalForm.condition_type,
        target_value: bulkSignalForm.condition_type === "news_mention" ? null : parseFloat(bulkSignalForm.target_value)
      });
      fetchData();
      setBulkModalOpen(false);
      setSelectedBonds(new Set());
      setMainTab("signals");
    } catch (e) {
      console.error(e);
      alert("Ошибка при массовом добавлении");
    }
  };

  const removeSignal = async (id: number) => {
    if (confirm("Удалить сигнал?")) {
      await api.investments.removeSignal(id);
      fetchData();
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
                    <th className="font-medium p-4 min-w-[200px]">Сигналы</th>
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
                        <td className="p-4">
                          {addingSignalFor === item.bond.id ? (
                            <form className="flex gap-2" onSubmit={(e) => addSignal(e, item.bond.id)}>
                              <select
                                className="bg-[var(--background)] text-xs border border-[var(--border)] rounded px-2 py-1 outline-none max-w-[120px]"
                                value={signalForm.condition_type}
                                onChange={e => setSignalForm({ ...signalForm, condition_type: e.target.value })}
                              >
                                <option value="price_less">Цена меньше</option>
                                <option value="price_greater">Цена больше</option>
                                <option value="price_change_drop_greater">Падение за день &gt; %</option>
                                <option value="news_mention">В новостях</option>
                              </select>
                              {signalForm.condition_type !== "news_mention" && (
                                <input
                                  type="number" step="0.01" required placeholder="Значение"
                                  className="bg-[var(--background)] text-xs border border-[var(--border)] rounded px-2 py-1 outline-none w-20"
                                  value={signalForm.target_value}
                                  onChange={e => setSignalForm({ ...signalForm, target_value: e.target.value })}
                                />
                              )}
                              <button type="submit" className="text-xs bg-blue-500/10 text-blue-500 font-medium px-2 py-1 rounded hover:bg-blue-500/20">
                                Сохранить
                              </button>
                              <button type="button" onClick={() => setAddingSignalFor(null)} className="text-[var(--muted)] hover:text-[var(--foreground)]">
                                ✕
                              </button>
                            </form>
                          ) : (
                            <button
                              onClick={() => {
                                setAddingSignalFor(item.bond.id);
                                setSignalForm({ condition_type: "price_less", target_value: "" });
                              }}
                              className="text-xs font-medium text-[var(--accent)] hover:opacity-80 transition-opacity"
                            >
                              + Добавить сигнал
                            </button>
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
        <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-6 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-[var(--foreground)] font-semibold text-lg">Активные сигналы</h2>
            <button onClick={() => setMainTab("portfolio")} className="text-[var(--accent)] text-sm hover:underline">
              + Добавить из портфеля
            </button>
          </div>
          
          {signals.length === 0 ? (
            <div className="text-center p-12 border border-[var(--border)] border-dashed rounded-xl">
              <p className="text-[var(--muted)]">У вас пока нет активных сигналов.</p>
              <p className="text-[var(--muted)] text-sm mt-2">Вы можете создать сигнал, перейдя в &quot;Мой портфель&quot;. Бот уведомит вас, когда цена достигнет цели.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {signals.map(sig => (
                <div key={sig.id} className="p-4 bg-[var(--background)] border border-[var(--border)] rounded-xl flex justify-between items-center group hover:border-[var(--accent)] transition-colors">
                  <div>
                    <p className="font-semibold text-[var(--foreground)] mb-1">{sig.bond.shortname}</p>
                    <div className="inline-flex items-center space-x-2 text-sm bg-blue-500/10 text-blue-500 px-2 py-1 rounded">
                      <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                      <span>
                        {sig.condition_type === "price_less" && `Цена упадёт ниже ${sig.target_value}`}
                        {sig.condition_type === "price_greater" && `Цена вырастет выше ${sig.target_value}`}
                        {sig.condition_type === "yield_greater" && `Доходность > ${sig.target_value}%`}
                        {sig.condition_type === "yield_less" && `Доходность < ${sig.target_value}%`}
                        {sig.condition_type === "price_change_drop_greater" && `Падение за сессию > ${sig.target_value}%`}
                        {sig.condition_type === "price_change_grow_greater" && `Рост за сессию > ${sig.target_value}%`}
                        {sig.condition_type === "news_mention" && `Упоминание в новостях`}
                      </span>
                    </div>
                  </div>
                  <button 
                    onClick={() => removeSignal(sig.id)} 
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-[var(--card-hover)] text-[var(--muted)] hover:bg-red-500/10 hover:text-red-500 transition-colors"
                    title="Удалить сигнал"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* STICKY BULK ACTION BAR */}
      {selectedBonds.size > 0 && mainTab === "portfolio" && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[var(--card)] border border-[var(--border)] shadow-2xl rounded-full p-2 px-6 flex items-center gap-6 z-40 animate-fade-in shadow-black/20">
          <span className="font-medium text-[var(--foreground)] pl-2">Выбрано {selectedBonds.size}</span>
          <div className="w-px h-6 bg-[var(--border)]"></div>
          <button onClick={() => setBulkModalOpen(true)} className="bg-[var(--accent)] text-white px-5 py-2 rounded-full font-semibold hover:opacity-90 shadow-sm transition-opacity">
            Настроить сигналы ({selectedBonds.size})
          </button>
        </div>
      )}

      {/* BULK SIGNAL MODAL */}
      {bulkModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-xl w-full max-w-md overflow-hidden animate-fade-in">
            <div className="p-6 border-b border-[var(--border)] flex justify-between items-center">
              <h3 className="font-semibold text-lg text-[var(--foreground)]">Сигналы ({selectedBonds.size} шт.)</h3>
              <button type="button" onClick={() => setBulkModalOpen(false)} className="text-[var(--muted)] hover:text-[var(--foreground)] p-1">✕</button>
            </div>
            <form onSubmit={addBulkSignals} className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-[var(--muted)] mb-2 font-medium">Событие</label>
                <select
                  className="w-full bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] rounded-lg px-4 py-2.5 outline-none focus:border-[var(--accent)] transition-colors"
                  value={bulkSignalForm.condition_type}
                  onChange={e => setBulkSignalForm({...bulkSignalForm, condition_type: e.target.value})}
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
              
              {bulkSignalForm.condition_type !== "news_mention" && (
                <div className="animate-fade-in">
                  <label className="block text-sm text-[var(--muted)] mb-2 font-medium">Значение (например: 5.5)</label>
                  <input
                    type="number" step="0.01" required
                    className="w-full bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] rounded-lg px-4 py-2.5 outline-none focus:border-[var(--accent)] transition-colors"
                    placeholder="Укажите порог"
                    value={bulkSignalForm.target_value}
                    onChange={e => setBulkSignalForm({...bulkSignalForm, target_value: e.target.value})}
                  />
                </div>
              )}
              
              <div className="pt-4">
                <button type="submit" className="w-full bg-[var(--accent)] text-white px-4 py-3 rounded-xl font-semibold hover:opacity-90 transition-opacity flex justify-center items-center">
                  Установить на {selectedBonds.size} бумаг
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
