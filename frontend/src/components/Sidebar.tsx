/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";

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
    label: "Сохраненное",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
        <path fillRule="evenodd" d="M6 3a3 3 0 0 0-3 3v12a.75.75 0 0 0 1.127.65l5.873-3.356 5.873 3.356A.75.75 0 0 0 17 18V6a3 3 0 0 0-3-3H6Z" clipRule="evenodd" />
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
    href: "/signals",
    label: "Сигналы",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
        <path fillRule="evenodd" d="M10 2a6 6 0 00-6 6c0 1.887-.454 3.665-1.257 5.234a.75.75 0 00.515 1.076 32.91 32.91 0 003.256.508 3.5 3.5 0 006.972 0 32.903 32.903 0 003.256-.508.75.75 0 00.515-1.076A11.448 11.448 0 0116 8a6 6 0 00-6-6zm0 14.5a2 2 0 01-1.95-1.557 33.146 33.146 0 003.9 0A2 2 0 0110 16.5z" clipRule="evenodd" />
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
    href: "/apps",
    label: "Приложения",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
        <path fillRule="evenodd" d="M4.25 2A2.25 2.25 0 002 4.25v2.5A2.25 2.25 0 004.25 9h2.5A2.25 2.25 0 009 6.75v-2.5A2.25 2.25 0 006.75 2h-2.5zm0 9A2.25 2.25 0 002 13.25v2.5A2.25 2.25 0 004.25 18h2.5A2.25 2.25 0 009 15.75v-2.5A2.25 2.25 0 006.75 11h-2.5zm9-9A2.25 2.25 0 0011 4.25v2.5A2.25 2.25 0 0013.25 9h2.5A2.25 2.25 0 0018 6.75v-2.5A2.25 2.25 0 0015.75 2h-2.5zm0 9A2.25 2.25 0 0011 13.25v2.5A2.25 2.25 0 0013.25 18h2.5A2.25 2.25 0 0018 15.75v-2.5A2.25 2.25 0 0015.75 11h-2.5z" clipRule="evenodd" />
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

function NavLink({ href, label, icon, pathname, onClick }: { href: string; label: string; icon: React.ReactNode; pathname: string; onClick?: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
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
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [leagues, setLeagues] = useState<string[]>([]);

  useEffect(() => {
    setMounted(true);
    setHasToken(!!(typeof window !== "undefined" && localStorage.getItem("token")));
  }, [pathname]);

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Sync added apps (leagues) to sidebar
  useEffect(() => {
    const fetchLeagues = () => {
      if (hasToken) {
        api.apps.getSettings().then(s => {
          const l = Array.isArray(s.football_leagues) ? s.football_leagues : [];
          setLeagues(l.filter(x => x.length > 3 || x === "ЛЧ"));
        }).catch(() => {});
      }
    };
    
    fetchLeagues();
    window.addEventListener("app_settings_updated", fetchLeagues);
    return () => window.removeEventListener("app_settings_updated", fetchLeagues);
  }, [hasToken, pathname]); // re-fetch occasionally on nav

  const sidebarContent = (
    <>
      <div className="p-4 border-b border-[var(--border)] shrink-0 flex items-center gap-2">
        <Link href="/" className="flex items-center gap-2.5 font-semibold text-lg tracking-tight" onClick={() => setOpen(false)}>
          <img src="/favicon.ico" alt="Логотип" className="w-6 h-6 shrink-0" />
          MyLent
        </Link>
      </div>
      <nav className="p-2 flex-1 min-h-0 overflow-y-auto">
        <ul className="space-y-0.5">
          {mainNav.map(({ href, label, icon }) => {
            const isApps = href === "/apps";
            const isActiveApps = pathname.startsWith("/apps");
            
            return (
              <li key={href}>
                <NavLink href={href} label={label} icon={icon} pathname={pathname} onClick={() => setOpen(false)} />
                
                {/* Apps dropdown subtree */}
                {isApps && isActiveApps && leagues.length > 0 && (
                  <ul className="mt-1 pl-9 pr-2 space-y-0.5 mb-2 animate-fade-in border-l-2 border-[var(--border)] ml-5">
                    {leagues.map(l => (
                      <li key={l}>
                        <Link 
                          href="/apps/sport/football"
                          onClick={() => setOpen(false)}
                          className="flex justify-between items-center px-3 py-1.5 text-[13px] text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--card-hover)] rounded-md transition-colors"
                        >
                          <span className="truncate">{l}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="p-2 border-t border-[var(--border)] shrink-0 flex items-center justify-between min-h-[52px]">
        <NavLink href={profileNav.href} label={profileNav.label} icon={profileNav.icon} pathname={pathname} onClick={() => setOpen(false)} />
        {mounted && pathname !== "/login" && (
          hasToken ? (
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") {
                  localStorage.removeItem("token");
                  window.location.href = "/login";
                }
              }}
              className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] shrink-0 px-2"
            >
              Выйти
            </button>
          ) : (
            <Link
              href="/login"
              className="text-sm text-[var(--accent)] hover:underline shrink-0 px-2"
              onClick={() => setOpen(false)}
            >
              Войти
            </Link>
          )
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 h-12 bg-[var(--card)] border-b border-[var(--border)] flex items-center px-3 gap-3">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="p-1.5 rounded-md hover:bg-[var(--card-hover)] transition-colors"
          aria-label="Меню"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            {open ? (
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            ) : (
              <path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zm0 5A.75.75 0 012.75 9h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 9.75zm0 5a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z" clipRule="evenodd" />
            )}
          </svg>
        </button>
        <Link href="/" className="flex items-center gap-2.5 font-semibold text-lg tracking-tight" onClick={() => setOpen(false)}>
          <img src="/favicon.ico" alt="Логотип" className="w-6 h-6 shrink-0" />
          MyLent
        </Link>
      </div>

      {/* Mobile overlay */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`md:hidden fixed top-12 left-0 bottom-0 z-50 w-64 bg-[var(--card)] border-r border-[var(--border)] flex flex-col transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 shrink-0 border-r border-[var(--border)] bg-[var(--card)] flex-col min-h-0">
        {sidebarContent}
      </aside>
    </>
  );
}
