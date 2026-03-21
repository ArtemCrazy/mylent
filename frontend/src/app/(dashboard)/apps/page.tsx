"use client";

import Link from "next/link";

export default function AppsPage() {
  return (
    <div className="p-6 max-w-5xl mx-auto animate-fade-in">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Приложения</h1>
        <p className="text-[var(--muted)] mt-2 text-lg">
          Готовые решения и сторонние интеграции, встроенные прямо в ваш дашборд.
        </p>
      </header>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link href="/apps/sport" className="block group">
           <div className="border border-[var(--border)] bg-[var(--card)] rounded-2xl p-6 hover:border-[var(--accent)] hover:shadow-md transition-all h-full bg-gradient-to-br from-[var(--card)] to-[var(--card-hover)]">
             <div className="w-14 h-14 bg-blue-500/15 text-blue-500 rounded-2xl flex items-center justify-center text-3xl mb-5 group-hover:scale-110 transition-transform shadow-sm">
               🏅
             </div>
             <h2 className="font-semibold text-xl mb-2 text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors">
               Спорт
             </h2>
             <p className="text-[var(--muted)] text-sm leading-relaxed">
               Следите за результатами матчей по футболу, хоккею, UFC и автоспорту в едином приложении.
             </p>
           </div>
        </Link>
      </div>
    </div>
  );
}
