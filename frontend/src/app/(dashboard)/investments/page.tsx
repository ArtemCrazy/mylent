"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";

type Bond = {
  id: number;
  secid: string;
  isin: string;
  name: string;
  shortname: string;
  current_price?: number;
  current_yield?: number;
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
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [signals, setSignals] = useState<SignalItem[]>([]);

  const [signalForm, setSignalForm] = useState<{bond_id: number | null, condition_type: string, target_value: string}>({
    bond_id: null,
    condition_type: "price_less",
    target_value: "",
  });

  const fetchData = async () => {
    try {
      const res = await api._request("/api/investments/portfolio");
      const data = await res.json();
      setPortfolio(data.portfolio || []);
      setSignals(data.signals || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.length > 2) {
        setIsSearching(true);
        try {
          const res = await api._request(`/api/investments/search?q=${encodeURIComponent(searchQuery)}`);
          const data = await res.json();
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
  }, [searchQuery]);

  const addToPortfolio = async (secid: string, name: string, shortname: string, isin: string) => {
    try {
      await api._request("/api/investments/portfolio", {
        method: "POST",
        body: JSON.stringify({ secid, isin, name, shortname, quantity: 1, average_price: null })
      });
      fetchData();
      setSearchQuery("");
      setSearchResults([]);
    } catch (e) {
      alert("Ошибка при добавлении в портфель");
    }
  };

  const removeFromPortfolio = async (id: number) => {
    if (confirm("Удалить из портфеля?")) {
      await api._request(`/api/investments/portfolio/${id}`, { method: "DELETE" });
      fetchData();
    }
  };

  const addSignal = async (e: React.FormEvent, bondId: number) => {
    e.preventDefault();
    if (!signalForm.target_value) return;

    try {
      await api._request("/api/investments/signals", {
        method: "POST",
        body: JSON.stringify({
          bond_id: bondId,
          condition_type: signalForm.condition_type,
          target_value: parseFloat(signalForm.target_value)
        })
      });
      fetchData();
      setSignalForm({ ...signalForm, target_value: "" });
    } catch (error) {
      alert("Ошибка при добавлении сигнала");
    }
  };

  const removeSignal = async (id: number) => {
    if (confirm("Удалить сигнал?")) {
      await api._request(`/api/investments/signals/${id}`, { method: "DELETE" });
      fetchData();
    }
  };

  return (
    <div className="p-4 md:p-6 lg:max-w-6xl lg:mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-[var(--foreground)]">Инвестиции</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Search */}
        <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-5 shadow-sm">
          <h2 className="text-[var(--foreground)] font-semibold text-lg mb-4">Поиск на MOEX</h2>
          
          <div className="relative mb-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Название или ISIN (напр. ОФЗ)..."
              className="w-full bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] rounded-md px-3 py-2 outline-none focus:border-[var(--accent)]"
            />
            {isSearching && (
              <div className="absolute right-3 top-2.5 w-4 h-4 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
            )}
          </div>

          <div className="max-h-[300px] overflow-y-auto space-y-2">
            {searchResults.map((res: any, idx: number) => (
              <div key={idx} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 rounded-lg border border-[var(--border)] bg-[var(--background)] hover:border-[var(--accent)] transition-colors">
                <div className="mb-2 sm:mb-0">
                  <p className="font-medium text-sm text-[var(--foreground)]">{res[2] || res[1]}</p>
                  <p className="text-xs text-[var(--muted)]">{res[3]} ({res[0]})</p>
                </div>
                <button
                  onClick={() => addToPortfolio(res[0], res[1], res[2], res[3])}
                  className="bg-[var(--accent-soft)] text-[var(--accent)] px-3 py-1.5 rounded text-xs font-semibold hover:opacity-80 transition-opacity"
                >
                  В портфель
                </button>
              </div>
            ))}
            {searchQuery.length > 2 && searchResults.length === 0 && !isSearching && (
              <p className="text-sm text-[var(--muted)]">Ничего не найдено</p>
            )}
          </div>
        </div>

        {/* Portfolio */}
        <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-5 shadow-sm">
          <h2 className="text-[var(--foreground)] font-semibold text-lg mb-4">Мой портфель</h2>
          
          {portfolio.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Портфель пуст. Найдите облигации через поиск.</p>
          ) : (
            <div className="space-y-4">
              {portfolio.map(item => (
                <div key={item.id} className="relative p-4 rounded-lg flex flex-col gap-3 border border-[var(--border)] bg-[var(--background)]">
                  <button onClick={() => removeFromPortfolio(item.id)} className="absolute top-2 right-2 text-[var(--muted)] hover:text-red-500">
                    ✕
                  </button>
                  <div>
                    <h3 className="font-semibold text-[var(--foreground)] pr-6">{item.bond.shortname}</h3>
                    <p className="text-xs text-[var(--muted)]">{item.bond.isin}</p>
                  </div>
                  
                  <div className="flex gap-4 text-sm bg-[var(--card-hover)] p-2 rounded px-3">
                    <div>
                      <span className="text-[var(--muted)] block text-xs">Цена</span>
                      <span className="font-medium">{item.bond.current_price || "—"}%</span>
                    </div>
                    <div>
                      <span className="text-[var(--muted)] block text-xs">Доходность</span>
                      <span className="font-medium">{item.bond.current_yield || "—"}%</span>
                    </div>
                  </div>

                  <form className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-[var(--border)]" onSubmit={(e) => addSignal(e, item.bond.id)}>
                    <select
                      className="bg-[var(--background)] text-xs border border-[var(--border)] rounded px-2 py-1 outline-none focus:border-[var(--accent)]"
                      value={signalForm.bond_id === item.bond.id ? signalForm.condition_type : "price_less"}
                      onChange={e => setSignalForm({ ...signalForm, bond_id: item.bond.id, condition_type: e.target.value })}
                    >
                      <option value="price_less">Цена ниже</option>
                      <option value="price_greater">Цена выше</option>
                      <option value="yield_greater">Доходность выше</option>
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="Значение"
                      className="bg-[var(--background)] text-xs border border-[var(--border)] rounded px-2 py-1 outline-none focus:border-[var(--accent)] w-24"
                      value={signalForm.bond_id === item.bond.id ? signalForm.target_value : ""}
                      onChange={e => setSignalForm({ ...signalForm, bond_id: item.bond.id, target_value: e.target.value })}
                    />
                    <button type="submit" className="text-xs bg-blue-500/10 text-blue-500 font-medium px-2 py-1 rounded hover:bg-blue-500/20">
                      + Сигнал
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Signals */}
      <div className="mt-6 bg-[var(--card)] rounded-xl border border-[var(--border)] p-5 shadow-sm">
        <h2 className="text-[var(--foreground)] font-semibold text-lg mb-4">Активные сигналы</h2>
        
        {signals.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Нет активных сигналов.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {signals.map(sig => (
              <div key={sig.id} className="p-3 bg-[var(--card-hover)] border border-[var(--border)] rounded-lg flex justify-between items-center">
                <div>
                  <p className="font-medium text-sm text-[var(--foreground)]">{sig.bond.shortname}</p>
                  <p className="text-xs text-blue-500 mt-1">
                    {sig.condition_type === "price_less" && `Цена < ${sig.target_value}%`}
                    {sig.condition_type === "price_greater" && `Цена > ${sig.target_value}%`}
                    {sig.condition_type === "yield_greater" && `Доходность > ${sig.target_value}%`}
                    {sig.condition_type === "yield_less" && `Доходность < ${sig.target_value}%`}
                  </p>
                </div>
                <button onClick={() => removeSignal(sig.id)} className="text-[var(--muted)] hover:text-red-500">
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
