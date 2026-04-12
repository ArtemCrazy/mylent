"use client";

import Link from "next/link";

const apps = [
  {
    href: "/apps/sport",
    icon: "🏅",
    title: "Спорт",
    accent: "from-blue-500/15 to-indigo-500/5 text-blue-400",
    description: "Следите за результатами матчей по футболу, хоккею, UFC и автоспорту в едином приложении.",
  },
  {
    href: "/investments",
    icon: "📈",
    title: "Облигации",
    accent: "from-emerald-500/15 to-teal-500/5 text-emerald-400",
    description: "Следите за облигациями, получайте уведомления о достижении целевых значений доходности или цены.",
  },
];

export default function AppsPage() {
  return (
    <div className="p-6 max-w-5xl mx-auto animate-fade-in">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Приложения</h1>
        <p className="text-[var(--muted)] mt-2 text-lg">
          Дополнительные разделы и встроенные сервисы дашборда.
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {apps.map((app) => (
          <Link key={app.href} href={app.href} className="block group">
            <div className="border border-[var(--border)] bg-[var(--card)] rounded-2xl p-6 hover:border-[var(--accent)] hover:shadow-md transition-all h-full bg-gradient-to-br from-[var(--card)] to-[var(--card-hover)]">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl mb-5 group-hover:scale-110 transition-transform shadow-sm bg-gradient-to-br ${app.accent}`}>
                {app.icon}
              </div>
              <h2 className="font-semibold text-xl mb-2 text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors">
                {app.title}
              </h2>
              <p className="text-[var(--muted)] text-sm leading-relaxed">
                {app.description}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
