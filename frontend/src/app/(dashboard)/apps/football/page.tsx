"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

const RU_TEAMS: Record<string, string> = {
  // EPL
  "Arsenal": "Арсенал", "Chelsea": "Челси", "Manchester United": "МЮ", "Manchester City": "Манчестер Сити",
  "Liverpool": "Ливерпуль", "Tottenham": "Тоттенхэм", "Newcastle": "Ньюкасл", "Aston Villa": "Астон Вилла",
  "Everton": "Эвертон", "West Ham": "Вест Хэм", "Brighton": "Брайтон", "Wolverhampton": "Вулверхэмптон",
  "Fulham": "Фулхэм", "Crystal Palace": "Кристал Пэлас", "Bournemouth": "Борнмут",
  "Nottingham Forest": "Ноттингем Форрест", "Brentford": "Брентфорд", "Leicester": "Лестер",
  "Southampton": "Саутгемптон", "Ipswich": "Ипсвич",
  // RPL
  "Zenit Saint Petersburg": "Зенит", "Spartak Moscow": "Спартак М", "CSKA Moscow": "ЦСКА",
  "Dinamo Moscow": "Динамо М", "Lokomotiv Moscow": "Локомотив", "Krasnodar": "Краснодар",
  "Rostov": "Ростов", "Rubin": "Рубин", "Krylya Sovetov": "Крылья Советов", 
  "Akhmat Grozny": "Ахмат", "Fakel": "Факел", "Pari Nizhny Novgorod": "Пари НН",
  "Ural": "Урал", "Baltika": "Балтика", "Orenburg": "Оренбург", "Dynamo Makhachkala": "Динамо Мх"
};

function t(name: string) { return RU_TEAMS[name] || name; }

interface FlashscoreMatch {
  eventId: string;
  eventStageId: number;
  gameTime: string;
  homeName: string;
  awayName: string;
  homeScore?: number | string;
  awayScore?: number | string;
  tournamentName?: string;
  competition?: string;
}

function getLeagueName(m: FlashscoreMatch): string {
  // Typical Flashscore returns 'ENGLAND: Premier League'
  return m.tournamentName || m.competition || "Неизвестная лига";
}

function statusTranslate(stageId: number, gameTime: string): string {
  if (stageId === 1) return gameTime || "Ожидается";
  if (stageId === 38) return "Перерыв";
  if (stageId === 3 || stageId === 242) return "Завершен";
  if ([2, 12, 13, 6, 7].includes(stageId)) return `${gameTime || "Live"}'`;
  return gameTime || "—";
}

export default function FootballApp() {
  const [fixtures, setFixtures] = useState<FlashscoreMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [enabledLeagues, setEnabledLeagues] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  // We add an expanded accordions state to keep leagues open/closed
  const [expandedLeagues, setExpandedLeagues] = useState<Record<string, boolean>>({});
  const searchRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      
      const settings = await api.apps.getSettings();
      const userLeagues = Array.isArray(settings.football_leagues) ? settings.football_leagues : [];
      // Filter out old legacy shortcodes like 'EPL', 'RPL' which won't match true league names verbatim
      const filteredLeagues = userLeagues.filter(l => l.length > 3 || l === "ЛЧ");
      setEnabledLeagues(filteredLeagues);
      
      // Auto-expand user leagues
      const initialExpand: Record<string, boolean> = {};
      filteredLeagues.forEach(l => initialExpand[l] = true);
      setExpandedLeagues(initialExpand);

      const res = await api.apps.footballFixtures();
      let matches = Array.isArray(res) ? (res as FlashscoreMatch[]) : [];
      
      matches = matches.filter(m => {
        const lName = getLeagueName(m).toLowerCase();
        const hName = (m.homeName || "").toLowerCase();
        const aName = (m.awayName || "").toLowerCase();
        const isU18 = /u18|u-18|u 18|under 18/i.test(lName) || /u18|u-18|u 18|under 18/i.test(hName) || /u18|u-18|u 18|under 18/i.test(aName);
        const isWomen = /\(w\)|women/i.test(lName) || /\(w\)|women/i.test(hName) || /\(w\)|women/i.test(aName);
        return !isU18 && !isWomen;
      });

      setFixtures(matches);
    } catch (e: unknown) {
      const err = e as Error;
      if (err.message?.includes("SPORTDB_API_KEY")) {
         setError("Ключ SPORTDB_API_KEY не настроен на сервере.");
      } else {
         setError(err.message || "Ошибка загрузки данных");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle outside click to close search suggestions
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearching(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const uniqueAvailableLeagues = useMemo(() => {
    const set = new Set<string>();
    fixtures.forEach(m => set.add(getLeagueName(m)));
    return Array.from(set).sort();
  }, [fixtures]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return uniqueAvailableLeagues.filter(l => 
      l.toLowerCase().includes(searchQuery.toLowerCase()) && !enabledLeagues.includes(l)
    ).slice(0, 15);
  }, [searchQuery, uniqueAvailableLeagues, enabledLeagues]);

  async function updateLeaguesSetting(newArr: string[]) {
    try {
      setSavingConfig(true);
      setEnabledLeagues(newArr);
      await api.apps.updateSettings({ football_leagues: newArr });
    } catch (e) {
      console.error("Failed to save leagues", e);
    } finally {
      setSavingConfig(false);
    }
  }

  function addLeague(l: string) {
    if (enabledLeagues.includes(l)) return;
    const newArr = [...enabledLeagues, l];
    updateLeaguesSetting(newArr);
    setExpandedLeagues(prev => ({ ...prev, [l]: true }));
    setSearchQuery("");
    setIsSearching(false);
  }

  function removeLeague(l: string) {
    const newArr = enabledLeagues.filter(x => x !== l);
    updateLeaguesSetting(newArr);
  }

  function toggleAccordion(l: string) {
    setExpandedLeagues(prev => ({ ...prev, [l]: !prev[l] }));
  }

  return (
    <div className="p-6 max-w-4xl mx-auto animate-fade-in relative pb-20">
      <Link href="/apps" className="inline-flex items-center text-sm text-[var(--muted)] hover:text-[var(--foreground)] mb-6 transition-colors">
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 mr-1"><path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" /></svg>
        Назад к Приложениям
      </Link>
      
      <header className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Live Футбол ⚽</h1>
          <p className="text-[var(--muted)] mt-2">Ваша персональная лента футбольных турниров.</p>
        </div>
        <button onClick={fetchData} className="px-4 py-2 text-sm bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] shadow-sm rounded-lg transition-colors flex items-center gap-2">
          <svg viewBox="0 0 20 20" fill="currentColor" className={`w-4 h-4 ${loading && !error ? 'animate-spin' : ''}`}><path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0V5.36l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z" clipRule="evenodd" /></svg>
          Обновить
        </button>
      </header>

      {/* Cart Area */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 mb-8 shadow-sm">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-[var(--accent)]"><path fillRule="evenodd" d="M10 2a.75.75 0 01.75.75v5.59l1.95-2.1a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0L6.2 7.26a.75.75 0 111.1-1.02l1.95 2.1V2.75A.75.75 0 0110 2z" clipRule="evenodd" /><path d="M4 14a.75.75 0 01.75-.75h10.5a.75.75 0 010 1.5H4.75A.75.75 0 014 14z" /></svg>
          Выбранные лиги
        </h3>
        
        {/* Chips */}
        <div className="flex flex-wrap gap-2.5 mb-6">
          {enabledLeagues.length === 0 && (
            <span className="text-[var(--muted)] text-sm italic py-1">Вы пока не добавили ни одной лиги в свой список.</span>
          )}
          {enabledLeagues.map(l => (
            <span key={l} className="inline-flex items-center gap-2 px-3 py-1.5 bg-[var(--accent-soft)] border border-[var(--accent)] text-[var(--foreground)] font-medium text-sm rounded-xl transition-all shadow-sm">
              {l}
              <button disabled={savingConfig} onClick={() => removeLeague(l)} className="hover:text-red-500 hover:bg-red-500/10 p-1 rounded-full text-[var(--muted)] transition-colors">
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg>
              </button>
            </span>
          ))}
        </div>

        {/* Dynamic Search */}
        <div className="relative" ref={searchRef}>
          <div className="relative">
            <input
              type="text"
              placeholder="Введите название страны или лиги для поиска..."
              value={searchQuery}
              onFocus={() => setIsSearching(true)}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[var(--background)] border border-[var(--border)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] outline-none rounded-xl pl-10 pr-4 py-3 text-sm transition-shadow"
            />
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 absolute left-3 top-3.5 text-[var(--muted)]">
              <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
            </svg>
          </div>
          {(isSearching && searchQuery.trim() !== "") && (
            <div className="absolute z-20 w-full mt-2 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl max-h-72 overflow-y-auto">
              {searchResults.length === 0 ? (
                <div className="px-4 py-4 text-sm text-[var(--muted)] text-center">Извините, лиг по вашему запросу не найдено. Попробуйте другой запрос.</div>
              ) : (
                <div className="p-1">
                  {searchResults.map(l => (
                    <button
                      key={l}
                      onClick={() => addLeague(l)}
                      className="w-full text-left px-4 py-3 text-sm hover:bg-[var(--card-hover)] rounded-lg transition-colors flex justify-between items-center group"
                    >
                      <span className="font-semibold">{l}</span>
                      <span className="text-[var(--accent)] opacity-0 group-hover:opacity-100 transition-opacity">Добавить +</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {error ? (
        <div className="p-4 bg-red-500/10 text-red-500 border border-red-500/20 rounded-2xl flex items-center gap-3">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6 shrink-0"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
          {error}
        </div>
      ) : loading && fixtures.length === 0 ? (
        <div className="space-y-4 opacity-50">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-[var(--card)] rounded-2xl animate-pulse"></div>)}
        </div>
      ) : enabledLeagues.length === 0 ? (
        <div className="text-center py-16 text-[var(--muted)] bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-sm">
          <div className="text-4xl mb-4 opacity-50">🏟️</div>
          <p className="text-lg font-medium text-[var(--foreground)]">Корзина лиг пуста</p>
          <p className="mt-2 text-sm max-w-sm mx-auto">Используйте поиск выше, чтобы добавить интересующие вас турниры для отслеживания расписания матчей.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {enabledLeagues.map(league => {
            const matches = fixtures.filter(f => getLeagueName(f) === league);
            const isExpanded = !!expandedLeagues[league];
            
            return (
              <div key={league} className="bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-sm overflow-hidden hover:border-[var(--accent)]/40 transition-colors duration-300">
                <button 
                  onClick={() => toggleAccordion(league)}
                  className="w-full bg-[var(--card)] hover:bg-[var(--card-hover)] px-5 py-4 flex items-center justify-between text-left group transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl opacity-80 group-hover:opacity-100 transition-opacity">🏆</span>
                    <span className="text-[var(--foreground)] font-bold text-lg group-hover:text-[var(--accent)] transition-colors line-clamp-1">{league}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-semibold px-2.5 py-1 bg-[var(--accent-soft)] text-[var(--accent)] rounded-lg">
                      {matches.length} матчей
                    </span>
                    <div className={`p-1 rounded-full bg-[var(--background)] border border-[var(--border)] transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                       <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-[var(--muted)] group-hover:text-[var(--accent)]">
                         <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                       </svg>
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="animate-fade-in border-t border-[var(--border)] overflow-hidden">
                    {matches.length === 0 ? (
                      <div className="p-6 text-sm text-[var(--muted)] text-center bg-[var(--background)]/50">Сегодня нет активных матчей в этом турнире.</div>
                    ) : (
                      <div className="divide-y divide-[var(--border)]">
                        {matches.map((m) => {
                          const statusStr = statusTranslate(m.eventStageId, m.gameTime);
                          const isLive = [2, 12, 13, 6, 7].includes(m.eventStageId);
                          
                          return (
                            <div key={m.eventId} className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4 hover:bg-[var(--card-hover)]/30 transition-colors bg-[var(--background)]/30">
                              <div className="flex-1 w-full flex items-center justify-end">
                                <span className="font-semibold text-[15px] sm:text-base text-right px-2">{t(m.homeName)}</span>
                              </div>
                              
                              <div className="shrink-0 flex flex-col items-center justify-center w-[140px]">
                                {isLive ? (
                                  <div className="text-[13px] font-bold text-red-500 animate-pulse px-3 py-1 bg-red-500/10 rounded-full border border-red-500/20 shadow-sm">{statusStr}</div>
                                ) : (
                                  <div className="text-[13px] font-semibold text-[var(--foreground)] bg-[var(--card)] px-3 py-1.5 rounded-lg border border-[var(--border)] shadow-sm text-center min-w-[100px]">
                                    {statusStr}
                                  </div>
                                )}
                              </div>
                              
                              <div className="flex-1 w-full flex items-center justify-start">
                                <span className="font-semibold text-[15px] sm:text-base text-left px-2">{t(m.awayName)}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
