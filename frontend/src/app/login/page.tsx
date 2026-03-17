"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { access_token } = await api.auth.login(login, password);
      if (typeof window !== "undefined") {
        localStorage.setItem("token", access_token);
      }
      router.push("/");
      router.refresh();
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err !== null && "message" in err
            ? String((err as { message: unknown }).message)
            : "Ошибка входа";
      if (msg === "Failed to fetch" || (typeof msg === "string" && msg.toLowerCase().includes("fetch"))) {
        setError("Сервер не отвечает. Запустите backend: в папке backend выполните uvicorn app.main:app --reload --port 8000");
      } else {
        setError(String(msg));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h1 className="text-xl font-semibold mb-6">Вход в MyLent</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--muted)] mb-1">Логин</label>
            <input
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="crazy"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--muted)] mb-1">Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              required
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[var(--accent)] py-2 font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Вход…" : "Войти"}
          </button>
        </form>
        <p className="mt-4 text-xs text-[var(--muted)]">
          На MVP создайте пользователя через скрипт или API.{" "}
          <Link href="/" className="text-[var(--accent)] hover:underline">На главную</Link>
        </p>
      </div>
    </div>
  );
}
