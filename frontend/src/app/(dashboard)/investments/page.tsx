"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";

export default function InvestmentsGatewayPage() {
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

  const investmentDirections = [
    {
      href: "/investments/bonds",
      title: "Облигации",
      icon: "📜",
      description: "Ваш портфель облигаций, поиск на MOEX и настройка алёртов по цене и доходности.",
      accent: "from-emerald-500/15 to-teal-500/5 text-emerald-400"
    },
    {
      href: "/investments/stocks",
      title: "Акции",
      icon: "📈",
      description: "Отслеживание портфеля акций, дивидендов и сигналов (скоро).",
      accent: "from-blue-500/15 to-indigo-500/5 text-blue-400"
    }
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto animate-fade-in">
      <header className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)]">Инвестиции</h1>
          <p className="text-[var(--muted)] mt-2 text-lg">
            Выберите направление инвестиций
          </p>
        </div>

        {/* Settings Gear */}
        <div className="relative" ref={settingsRef}>
          <button 
            onClick={() => setSettingsOpen(!settingsOpen)}
            className="p-2 rounded-md text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--card-hover)] transition-colors"
            aria-label="Настройки инвестиций"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </button>

          {settingsOpen && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-lg z-10 p-2 animate-fade-in origin-top-right">
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
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {investmentDirections.map((dir) => (
          <Link key={dir.href} href={dir.href} className="block group">
            <div className="border border-[var(--border)] bg-[var(--card)] rounded-2xl p-6 hover:border-[var(--accent)] hover:shadow-md transition-all h-full bg-gradient-to-br from-[var(--card)] to-[var(--card-hover)]">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl mb-5 group-hover:scale-110 transition-transform shadow-sm bg-gradient-to-br ${dir.accent}`}>
                {dir.icon}
              </div>
              <h2 className="font-semibold text-xl mb-2 text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors">
                {dir.title}
              </h2>
              <p className="text-[var(--muted)] text-sm leading-relaxed">
                {dir.description}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
