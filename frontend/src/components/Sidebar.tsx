"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/", label: "Лента" },
  { href: "/saved", label: "Сохранённое" },
  { href: "/for-studio", label: "Полезно для студии" },
  { href: "/digests", label: "Дайджесты" },
  { href: "/sources", label: "Источники" },
  { href: "/settings", label: "Настройки" },
  { href: "/login", label: "Вход" },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-56 shrink-0 border-r border-[var(--border)] bg-[var(--card)] flex flex-col">
      <div className="p-4 border-b border-[var(--border)]">
        <Link href="/" className="font-semibold text-lg tracking-tight">
          MyLent
        </Link>
      </div>
      <nav className="p-2 flex-1">
        <ul className="space-y-0.5">
          {nav.map(({ href, label }) => (
            <li key={href}>
              <Link
                href={href}
                className={`block px-3 py-2 rounded-md text-sm transition-colors ${
                  pathname === href
                    ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "text-[var(--foreground)] hover:bg-[var(--card-hover)]"
                }`}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
