"use client";

import { useEffect, useState } from "react";
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

const LEAGUES = [
  { id: 39, name: "Английская Премьер-лига (АПЛ)", short: "АПЛ", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { id: 235, name: "Российская Премьер-лига (РПЛ)", short: "РПЛ", flag: "🇷🇺" },
  { id: 2, name: "Лига Чемпионов УЕФА", short: "ЛЧ", flag: "🇪🇺" },
];

function statusTranslate(status: string, elapsed: number | null): string {
  switch(status) {
    case "NS": return "Не начался";
    case "1H": return `${elapsed}' (1 тайм)`;
    case "HT": return "Перерыв";
    case "2H": return `${elapsed}' (2 тайм)`;
    case "FT": return "Завершен";
    case "PEN": return "Пенальти";
    case "AET": return "После доп. вр.";
    case "CANC": return "Отменен";
    case "PST": return "Перенесен";
    default: return status;
  }
}

export default function FootballApp() {
  const [fixtures, setFixtures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [enabledLeagues, setEnabledLeagues] = useState<number[]>([]);
  const [savingConfig, setSavingConfig] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      setError("");
      
      const settings = await api.apps.getSettings();
      const userLeagues = settings.football_leagues || [39, 235];
      setEnabledLeagues(userLeagues);
      
      const res = await api.apps.footballFixtures();
      setFixtures(res);
    } catch (e: any) {
      if (e.message?.includes("API_FOOTBALL_KEY")) {
         setError("Ключ API-Football не настроен на сервере.");
      } else {
         setError(e.message || "Ошибка загрузки данных");
      }
    } finally {
      setLoading(false);
    }
  }

  async function toggleLeague(id: number) {
    setSavingConfig(true);
    const newArr = enabledLeagues.includes(id) 
      ? enabledLeagues.filter(x => x !== id)
      : [...enabledLeagues, id];
    
    setEnabledLeagues(newArr);
    try {
      await api.apps.updateSettings({ football_leagues: newArr });
    } catch(e) {
      console.error("Failed to save layout settings", e);
    } finally {
      setSavingConfig(false);
    }
  }

  const activeFixtures = fixtures.filter(f => enabledLeagues.includes(f.league.id));

  return (
    <div className="p-6 max-w-4xl mx-auto animate-fade-in relative pb-20">
      <Link href="/apps" className="inline-flex items-center text-sm text-[var(--muted)] hover:text-[var(--foreground)] mb-6 transition-colors">
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 mr-1"><path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" /></svg>
        Назад к Приложениям
      </Link>
      
      <header className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Live Футбол ⚽</h1>
          <p className="text-[var(--muted)] mt-2">Расписание и результаты матчей на сегодня.</p>
        </div>
        <button onClick={fetchData} className="px-3 py-1.5 text-sm bg-[var(--card-hover)] hover:bg-[var(--border)] rounded-md transition-colors flex items-center gap-2">
          <svg viewBox="0 0 20 20" fill="currentColor" className={`w-4 h-4 ${loading && !error ? 'animate-spin' : ''}`}><path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0V5.36l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z" clipRule="evenodd" /></svg>
          Обновить
        </button>
      </header>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 mb-8">
        <h3 className="text-sm font-semibold mb-3">Отображаемые лиги</h3>
        <div className="flex flex-wrap gap-2">
          {LEAGUES.map(l => (
            <label key={l.id} className={`cursor-pointer flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${enabledLeagues.includes(l.id) ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--border)] opacity-70 hover:opacity-100'}`}>
              <input type="checkbox" checked={enabledLeagues.includes(l.id)} onChange={() => toggleLeague(l.id)} className="hidden" disabled={savingConfig} />
              <span>{l.flag} {l.short}</span>
            </label>
          ))}
        </div>
      </div>

      {error ? (
        <div className="p-4 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl">
          {error}
        </div>
      ) : loading && fixtures.length === 0 ? (
        <div className="space-y-3 opacity-50">
          {[1,2,3].map(i => <div key={i} className="h-20 bg-[var(--card)] rounded-xl animate-pulse"></div>)}
        </div>
      ) : activeFixtures.length === 0 ? (
        <div className="text-center py-12 text-[var(--muted)]">
          Сегодня нет матчей в выбранных лигах.
        </div>
      ) : (
        <div className="space-y-6">
          {LEAGUES.filter(l => enabledLeagues.includes(l.id)).map(league => {
            const matches = activeFixtures.filter(f => f.league.id === league.id);
            if (matches.length === 0) return null;
            
            return (
              <div key={league.id} className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden hover:border-[var(--accent)]/50 transition-colors">
                <div className="bg-[var(--card-hover)] px-4 py-2 border-b border-[var(--border)] font-medium flex items-center gap-2">
                  <span className="text-xl">{league.flag}</span> {league.name}
                </div>
                <div className="divide-y divide-[var(--border)]">
                  {matches.map(m => {
                    const statusStr = m.fixture.status.short;
                    const isLive = ["1H", "2H", "HT", "ET", "P"].includes(statusStr);
                    const time = new Date(m.fixture.date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
                    
                    return (
                      <div key={m.fixture.id} className="p-4 flex items-center justify-between group hover:bg-[var(--card-hover)]/30 transition-colors">
                        
                        <div className="w-16 text-center shrink-0">
                          {isLive ? (
                            <div className="text-xs font-bold text-red-500 animate-pulse">{statusTranslate(statusStr, m.fixture.status.elapsed)}</div>
                          ) : (
                            <div className="text-sm text-[var(--muted)] font-medium">{statusStr === "NS" ? time : statusTranslate(statusStr, null)}</div>
                          )}
                        </div>
                        
                        <div className="flex-1 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6 px-4">
                          <div className="flex-1 flex items-center justify-end gap-3 w-full sm:w-auto">
                            <span className="font-medium text-right line-clamp-1">{t(m.teams.home.name)}</span>
                            <img src={m.teams.home.logo} alt="" className="w-6 h-6 object-contain" />
                          </div>
                          
                          <div className="font-bold text-xl tracking-widest shrink-0 w-[60px] text-center px-2 bg-[var(--card-hover)] rounded-md py-1 shadow-inner border border-[var(--border)]">
                            {statusStr === "NS" ? "- : -" : `${m.goals.home ?? 0} : ${m.goals.away ?? 0}`}
                          </div>
                          
                          <div className="flex-1 flex items-center justify-start gap-3 w-full sm:w-auto">
                            <img src={m.teams.away.logo} alt="" className="w-6 h-6 object-contain" />
                            <span className="font-medium text-left line-clamp-1">{t(m.teams.away.name)}</span>
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
