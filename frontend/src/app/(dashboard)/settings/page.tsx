"use client";

import { useEffect, useState } from "react";
import { api, type Settings } from "@/lib/api";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.settings.get().then(setSettings).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  if (error) {
    return (
      <div className="p-8">
        <p className="text-red-400">Ошибка: {error}</p>
      </div>
    );
  }

  if (loading || !settings) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="h-8 w-32 bg-[var(--card)] rounded animate-pulse mb-6" />
        <div className="h-48 bg-[var(--card)] rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Настройки</h1>
        <p className="text-sm text-[var(--muted)]">Общие параметры и AI</p>
      </header>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 space-y-4">
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
