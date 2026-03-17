"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Если нет токена — сразу редирект на /login, чтобы пользователь видел форму входа.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      router.replace("/login");
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[var(--background)]">
        <p className="text-[var(--muted)]">Загрузка…</p>
      </div>
    );
  }

  return <>{children}</>;
}
