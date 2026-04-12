"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/api";

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
  const [assetTab, setAssetTab] = useState<"bonds" | "stocks">("bonds");

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
    if (!signalForm.target_value) return;

    try {
      await api.investments.addSignal({
          bond_id: bondId,
          condition_type: signalForm.condition_type,
          target_value: parseFloat(signalForm.target_value)
      });
      fetchData();
      setAddingSignalFor(null);
      setSignalForm({ condition_type: "price_less", target_value: "" });
    } catch (error) {
      console.error(error);
      alert("Ошибка при добавлении сигнала");
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
      <h1 className="text-2xl font-bold mb-6 text-[var(--foreground)]">Инвестиции</h1>

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
          {/* Asset Type Toggle */}
          <div className="flex p-4 border-b border-[var(--border)] bg-[var(--background)] gap-2">
            <button
              onClick={() => setAssetTab("bonds")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                assetTab === "bonds"
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--card-hover)] text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              Облигации
            </button>
            <button
              onClick={() => setAssetTab("stocks")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                assetTab === "stocks"
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--card-hover)] text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              Акции
            </button>
          </div>

          {assetTab === "stocks" ? (
            <div className="p-12 text-center text-[var(--muted)]">
              <p>Раздел акций пока в разработке. Скоро здесь появятся ваши акции.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[var(--card-hover)] text-[var(--muted)] text-sm border-b border-[var(--border)]">
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
                      <td colSpan={6} className="text-center p-8 text-[var(--muted)]">
                        Портфель пуст. Перейдите в &quot;Поиск активов&quot;, чтобы добавить облигации.
                      </td>
                    </tr>
                  ) : (
                    portfolio.map((item) => (
                      <tr key={item.id} className="hover:bg-[var(--card-hover)] transition-colors group">
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
                                className="bg-[var(--background)] text-xs border border-[var(--border)] rounded px-2 py-1 outline-none"
                                value={signalForm.condition_type}
                                onChange={e => setSignalForm({ ...signalForm, condition_type: e.target.value })}
                              >
                                <option value="price_less">Меньше</option>
                                <option value="price_greater">Больше</option>
                              </select>
                              <input
                                type="number" step="0.01" required placeholder="Значение"
                                className="bg-[var(--background)] text-xs border border-[var(--border)] rounded px-2 py-1 outline-none w-20"
                                value={signalForm.target_value}
                                onChange={e => setSignalForm({ ...signalForm, target_value: e.target.value })}
                              />
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
          )}
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
                        {sig.condition_type === "price_less" && `Цена упадёт ниже ${sig.target_value}%`}
                        {sig.condition_type === "price_greater" && `Цена вырастет выше ${sig.target_value}%`}
                        {sig.condition_type === "yield_greater" && `Доходность > ${sig.target_value}%`}
                        {sig.condition_type === "yield_less" && `Доходность < ${sig.target_value}%`}
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
    </div>
  );
}
