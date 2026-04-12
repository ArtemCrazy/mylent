"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { api, type AppSettings, type Settings } from "@/lib/api";

function TelegramSection() {
  const [status, setStatus] = useState<{ authorized: boolean; has_credentials: boolean; error?: string } | null>(null);
  const [step, setStep] = useState<"idle" | "phone" | "code" | "2fa" | "done">("idle");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const loadStatus = () => {
    api.telegram.status().then(setStatus).catch(() => setStatus(null));
  };

  useEffect(() => { loadStatus(); }, []);

  async function handleSendPhone(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      await api.telegram.sendPhone(phone);
      setStep("code");
      setMsg({ text: "Код отправлен в Telegram", ok: true });
    } catch (e: unknown) {
      setMsg({ text: e instanceof Error ? e.message : "Ошибка", ok: false });
    } finally {
      setLoading(false);
    }
  }

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      const res = await api.telegram.sendCode(phone, code, step === "2fa" ? password : undefined);
      setMsg({ text: res.message, ok: true });
      setStep("done");
      loadStatus();
    } catch (e: unknown) {
      const text = e instanceof Error ? e.message : "Ошибка";
      if (text.includes("2FA") || text.includes("пароль")) {
        setStep("2fa");
        setMsg({ text, ok: false });
      } else {
        setMsg({ text, ok: false });
      }
    } finally {
      setLoading(false);
    }
  }

  if (!status) {
    return <div className="h-6 w-48 bg-[var(--border)] rounded animate-pulse" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {status.authorized ? (
          <>
            <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
            <span className="text-sm text-green-400 font-medium">Подключён — синхронизация активна</span>
          </>
        ) : (
          <>
            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
            <span className="text-sm text-amber-400 font-medium">
              {!status.has_credentials ? "Нет API ключей (задайте TELEGRAM_API_ID/HASH)" : "Не авторизован — войдите в аккаунт"}
            </span>
          </>
        )}
      </div>

      {status.has_credentials && !status.authorized && step === "idle" && (
        <button
          onClick={() => setStep("phone")}
          className="px-4 py-2 rounded-md bg-[var(--accent)] text-white text-sm hover:opacity-90 transition-opacity"
        >
          Подключить Telegram
        </button>
      )}

      {step === "phone" && (
        <form onSubmit={handleSendPhone} className="flex gap-2 items-end flex-wrap">
          <div>
            <label className="block text-xs text-[var(--muted)] mb-1">Номер телефона</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+79001234567"
              required
              className="px-3 py-1.5 rounded-md border border-[var(--border)] bg-[var(--background)] text-sm w-48"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-1.5 rounded-md bg-[var(--accent)] text-white text-sm disabled:opacity-50"
          >
            {loading ? "…" : "Получить код"}
          </button>
          <button type="button" onClick={() => setStep("idle")} className="text-sm text-[var(--muted)] hover:underline">
            Отмена
          </button>
        </form>
      )}

      {(step === "code" || step === "2fa") && (
        <form onSubmit={handleSendCode} className="flex gap-2 items-end flex-wrap">
          <div>
            <label className="block text-xs text-[var(--muted)] mb-1">Код из Telegram</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="12345"
              required
              className="px-3 py-1.5 rounded-md border border-[var(--border)] bg-[var(--background)] text-sm w-32"
            />
          </div>
          {step === "2fa" && (
            <div>
              <label className="block text-xs text-[var(--muted)] mb-1">Пароль 2FA</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                className="px-3 py-1.5 rounded-md border border-[var(--border)] bg-[var(--background)] text-sm w-32"
              />
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-1.5 rounded-md bg-[var(--accent)] text-white text-sm disabled:opacity-50"
          >
            {loading ? "…" : "Войти"}
          </button>
          <button type="button" onClick={() => setStep("phone")} className="text-sm text-[var(--muted)] hover:underline">
            Назад
          </button>
        </form>
      )}

      {msg && (
        <p className={`text-sm ${msg.ok ? "text-green-400" : "text-red-400"}`}>{msg.text}</p>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [savingWeather, setSavingWeather] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.settings.get(), api.apps.getSettings()])
      .then(([baseSettings, currentAppSettings]) => {
        setSettings(baseSettings);
        setAppSettings(currentAppSettings);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function toggleWeather(enabled: boolean) {
    if (!appSettings) return;
    setSavingWeather(true);
    setError(null);

    try {
      const result = await api.apps.updateSettings({
        weather: {
          ...(appSettings.weather || {}),
          enabled,
        },
      });
      setAppSettings(result.settings);
      window.dispatchEvent(new Event("app_settings_updated"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось обновить настройки погоды.");
    } finally {
      setSavingWeather(false);
    }
  }

  if (error && !settings) {
    return (
      <div className="p-8">
        <p className="text-red-400">Ошибка: {error}</p>
      </div>
    );
  }

  if (loading || !settings || !appSettings) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="h-8 w-32 bg-[var(--card)] rounded animate-pulse mb-6" />
        <div className="h-48 bg-[var(--card)] rounded animate-pulse" />
      </div>
    );
  }

  const weatherEnabled = appSettings.weather?.enabled !== false;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Настройки</h1>
        <p className="text-sm text-[var(--muted)]">Общие параметры и подключения</p>
      </header>

      {error && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-[var(--accent)]">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8l-1.68 7.92c-.12.56-.48.7-.96.44l-2.64-1.94-1.28 1.22c-.14.14-.26.26-.52.26l.18-2.66 4.78-4.32c.2-.18-.06-.28-.32-.1L7.34 14.6l-2.56-.8c-.56-.18-.58-.56.12-.82l10.02-3.86c.46-.18.86.1.72.68z" />
          </svg>
          Telegram
        </h2>
        <TelegramSection />
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 space-y-4">
        <h2 className="text-base font-semibold">Интерфейс</h2>
        <div className="flex items-start justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-4">
          <div>
            <div className="font-medium">Отображать погоду</div>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Погодный виджет показывается над профилем сразу после авторизации.
            </p>
            <Link href="/apps/weather" className="mt-2 inline-flex text-sm text-[var(--accent)] hover:underline">
              Настроить погоду
            </Link>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={weatherEnabled}
            disabled={savingWeather}
            onClick={() => toggleWeather(!weatherEnabled)}
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
              weatherEnabled ? "bg-[var(--accent)]" : "bg-[var(--border)]"
            } ${savingWeather ? "opacity-60" : ""}`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                weatherEnabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 space-y-4">
        <h2 className="text-base font-semibold">Общие</h2>
        <div>
          <label className="text-sm font-medium text-[var(--muted)]">Тема</label>
          <p className="mt-1">{settings.theme === "dark" ? "Тёмная" : "Светлая"}</p>
        </div>
        <div>
          <label className="text-sm font-medium text-[var(--muted)]">AI-сводки</label>
          <p className="mt-1">{settings.ai_summary_enabled ? "Включены" : "Выключены"}</p>
        </div>
        <div>
          <label className="text-sm font-medium text-[var(--muted)]">Дайджесты</label>
          <p className="mt-1">{settings.digest_enabled ? "Включены" : "Выключены"}</p>
        </div>
        <div>
          <label className="text-sm font-medium text-[var(--muted)]">Интервал синхронизации</label>
          <p className="mt-1">{settings.sync_interval_minutes} мин</p>
        </div>
        <p className="text-xs text-[var(--muted)] pt-2">
          Изменение настроек через API будет доступно в следующих версиях.
        </p>
      </div>
    </div>
  );
}
