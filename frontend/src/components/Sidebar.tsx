"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const mainNav = [
  {
    href: "/",
    label: "Лента",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
        <path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zm0 5A.75.75 0 012.75 9h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 9.75zm0 5a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5a.75.75 0 01-.75-.75z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    href: "/saved",
    label: "Сохранённое",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
        <path fillRule="evenodd" d="M10 2a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.791L10 14.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L2.82 8.124a.75.75 0 01.416-1.28l4.21-.611L9.327 2.418A.75.75 0 0110 2z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    href: "/for-studio",
    label: "Полезно для студии",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
        <path d="M10 1a6 6 0 00-3.815 10.631C7.237 12.5 8 13.443 8 14.456v.644a.75.75 0 00.572.729 6.016 6.016 0 002.856 0A.75.75 0 0012 15.1v-.644c0-1.013.762-1.957 3.815-2.825A6 6 0 0010 1zM8.863 17.414a.75.75 0 00-.226 1.483 9.066 9.066 0 002.726 0 .75.75 0 00-.226-1.483 7.553 7.553 0 01-2.274 0z" />
      </svg>
    ),
  },
  {
    href: "/digests",
    label: "Дайджесты",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a.75.75 0 01.75-.75h6.5a.75.75 0 010 1.5h-6.5A.75.75 0 016 10zm.75 2.75a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    href: "/sources",
    label: "Источники",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
        <path d="M10 2a.75.75 0 01.75.75v.258a33.186 33.186 0 016.668.83.75.75 0 01-.336 1.461 31.28 31.28 0 00-1.103-.232l1.702 7.545a.75.75 0 01-.387.832A4.981 4.981 0 0115 14c-.825 0-1.606-.2-2.294-.556a.75.75 0 01-.387-.832l1.77-7.849a31.743 31.743 0 00-3.339-.254v11.505a20.01 20.01 0 013.78.501.75.75 0 11-.339 1.462A18.558 18.558 0 0010 17.5a18.558 18.558 0 00-4.191.512.75.75 0 11-.34-1.462 20.01 20.01 0 013.781-.501V4.509a31.742 31.742 0 00-3.339.254l1.77 7.849a.75.75 0 01-.387.832A4.98 4.98 0 015 14a4.98 4.98 0 01-2.294-.556.75.75 0 01-.387-.832L4.021 5.067c-.37.07-.738.148-1.103.232A.75.75 0 012.582 3.84a33.187 33.187 0 016.668-.831V2.75A.75.75 0 0110 2z" />
      </svg>
    ),
  },
  {
    href: "/settings",
    label: "Настройки",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
        <path fillRule="evenodd" d="M7.84 1.804A1 1 0 018.82 1h2.36a1 1 0 01.98.804l.331 1.652a6.993 6.993 0 011.929 1.115l1.598-.54a1 1 0 011.186.447l1.18 2.044a1 1 0 01-.205 1.251l-1.267 1.113a7.047 7.047 0 010 2.228l1.267 1.113a1 1 0 01.206 1.25l-1.18 2.045a1 1 0 01-1.187.447l-1.598-.54a6.993 6.993 0 01-1.929 1.115l-.33 1.652a1 1 0 01-.98.804H8.82a1 1 0 01-.98-.804l-.331-1.652a6.993 6.993 0 01-1.929-1.115l-1.598.54a1 1 0 01-1.186-.447l-1.18-2.044a1 1 0 01.205-1.251l1.267-1.114a7.05 7.05 0 010-2.227L1.821 7.773a1 1 0 01-.206-1.25l1.18-2.045a1 1 0 011.187-.447l1.598.54A6.993 6.993 0 017.51 3.456l.33-1.652zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
      </svg>
    ),
  },
];

const profileNav = {
  href: "/login",
  label: "Профиль",
  icon: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-5.5-2.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zM10 12a5.99 5.99 0 00-4.793 2.39A6.483 6.483 0 0010 16.5a6.483 6.483 0 004.793-2.11A5.99 5.99 0 0010 12z" clipRule="evenodd" />
    </svg>
  ),
};

function NavLink({ href, label, icon, pathname }: { href: string; label: string; icon: React.ReactNode; pathname: string }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
        pathname === href
          ? "bg-[var(--accent-soft)] text-[var(--accent)]"
          : "text-[var(--foreground)] hover:bg-[var(--card-hover)]"
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [hasToken, setHasToken] = useState(false);
  useEffect(() => {
    setHasToken(!!(typeof window !== "undefined" && localStorage.getItem("token")));
  }, [pathname]);

  return (
    <aside className="w-56 shrink-0 border-r border-[var(--border)] bg-[var(--card)] flex flex-col min-h-0">
      <div className="p-4 border-b border-[var(--border)] shrink-0 flex items-center justify-between gap-2">
        <Link href="/" className="font-semibold text-lg tracking-tight">
          MyLent
        </Link>
        {pathname !== "/login" && (
          hasToken ? (
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") {
                  localStorage.removeItem("token");
                  window.location.href = "/login";
                }
              }}
              className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] shrink-0"
            >
              Выйти
            </button>
          ) : (
            <Link
              href="/login"
              className="text-sm text-[var(--accent)] hover:underline shrink-0"
            >
              Войти
            </Link>
          )
        )}
      </div>
      <nav className="p-2 flex-1 min-h-0 overflow-y-auto">
        <ul className="space-y-0.5">
          {mainNav.map(({ href, label, icon }) => (
            <li key={href}>
              <NavLink href={href} label={label} icon={icon} pathname={pathname} />
            </li>
          ))}
        </ul>
      </nav>
      <div className="p-2 border-t border-[var(--border)] shrink-0">
        <NavLink href={profileNav.href} label={profileNav.label} icon={profileNav.icon} pathname={pathname} />
      </div>
    </aside>
  );
}
