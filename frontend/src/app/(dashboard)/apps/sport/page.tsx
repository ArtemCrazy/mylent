"use client";

import Link from "next/link";

export default function SportAppPage() {
  const sports = [
    {
      name: "Футбол",
      href: "/apps/sport/football",
      icon: "⚽",
      color: "bg-green-500/15 text-green-500",
      desc: "Live-результаты и расписание футбольных лиг мира."
    },
    {
      name: "Хоккей",
      href: "/apps/sport/hockey",
      icon: "🏒",
      color: "bg-blue-500/15 text-blue-500",
      desc: "Регулярные чемпионаты и плей-офф (НХЛ, КХЛ)."
    },
    {
      name: "UFC",
      href: "/apps/sport/ufc",
      icon: "🥊",
      color: "bg-red-500/15 text-red-500",
      desc: "Календарь турниров и результаты боев UFC."
    },
    {
      name: "Формула 1",
      href: "/apps/sport/f1",
      icon: "🏎️",
      color: "bg-yellow-500/15 text-yellow-600",
      desc: "Расписание Гран-при и турнирная таблица гонщиков."
    }
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto animate-fade-in relative pb-20">
      <Link href="/apps" className="inline-flex items-center text-sm text-[var(--muted)] hover:text-[var(--foreground)] mb-6 transition-colors">
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 mr-1"><path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" /></svg>
        К списку приложений
      </Link>
      
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Спорт 🏅</h1>
        <p className="text-[var(--muted)] mt-2 text-lg">
          Выберите вид спорта, чтобы настроить вашу спортивную ленту.
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {sports.map(s => (
          <Link key={s.name} href={s.href} className="block group">
             <div className="border border-[var(--border)] bg-[var(--card)] rounded-2xl p-6 hover:border-[var(--accent)] hover:shadow-md transition-all h-full bg-gradient-to-br from-[var(--card)] to-[var(--card-hover)] flex flex-col">
               <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl mb-5 group-hover:scale-110 transition-transform shadow-sm ${s.color}`}>
                 {s.icon}
               </div>
               <h2 className="font-semibold text-xl mb-2 text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors">
                 {s.name}
               </h2>
               <p className="text-[var(--muted)] text-sm leading-relaxed flex-1">
                 {s.desc}
               </p>
             </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
