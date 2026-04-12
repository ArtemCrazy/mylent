"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { WeatherWidgetCard } from "@/components/WeatherWidgetCard";
import { api, type WeatherForecast, type WeatherLocationSearchResult, type WeatherSettings } from "@/lib/api";

const WEATHER_REFRESH_MS = 5 * 60 * 1000;
const WEATHER_CACHE_KEY = "mylent_weather_cache_v1";

type WeatherCacheEntry = {
  forecast: WeatherForecast;
  fetchedAt: number;
  signature: string;
};

function getWeatherSignature(settings?: Pick<WeatherSettings, "mode" | "city_name" | "latitude" | "longitude" | "timezone"> | null) {
  return JSON.stringify({
    mode: settings?.mode ?? null,
    city_name: settings?.city_name ?? null,
    latitude: settings?.latitude ?? null,
    longitude: settings?.longitude ?? null,
    timezone: settings?.timezone ?? null,
  });
}

function readWeatherCache(signature?: string | null) {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(WEATHER_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WeatherCacheEntry;
    if (!parsed?.forecast || !parsed?.signature) return null;
    if (signature && parsed.signature !== signature) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeWeatherCache(signature: string, forecast: WeatherForecast) {
  if (typeof window === "undefined") return;

  try {
    const payload: WeatherCacheEntry = {
      forecast,
      fetchedAt: Date.now(),
      signature,
    };
    window.sessionStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(payload));
  } catch {}
}

const ALERT_OPTIONS = [
  { value: null as null, label: "Не предупреждать" },
  { value: 30 as const, label: "30 мин" },
  { value: 60 as const, label: "1 час" },
  { value: 120 as const, label: "2 часа" },
  { value: 240 as const, label: "4 часа" },
  { value: 720 as const, label: "12 часов" },
];

const SECTION_TABS = [
  { id: "city" as const, label: "Город" },
  { id: "display" as const, label: "Настройки" },
  { id: "alerts" as const, label: "Предупреждения" },
];

const DISPLAY_OPTIONS = [
  {
    key: "show_location" as const,
    title: "Город",
    description: "Показывать название города под заголовком виджета.",
  },
  {
    key: "show_apparent_temperature" as const,
    title: "Ощущается",
    description: "Показывать температуру по ощущениям рядом с основной.",
  },
  {
    key: "show_wind" as const,
    title: "Ветер",
    description: "Показывать текущую скорость ветра внутри виджета.",
  },
  {
    key: "show_pressure" as const,
    title: "Давление",
    description: "Показывать текущее атмосферное давление.",
  },
  {
    key: "show_magnetic_activity" as const,
    title: "Магнитный фон",
    description: "Показывать текущее значение магнитного фона.",
  },
];

type WeatherPageTab = "city" | "display" | "alerts";
type WeatherDisplayKey = (typeof DISPLAY_OPTIONS)[number]["key"];
type WeatherAlertMinutes = (typeof ALERT_OPTIONS)[number]["value"];
type WeatherViewSettings = WeatherSettings & {
  show_location?: boolean;
  show_apparent_temperature?: boolean;
  show_wind?: boolean;
  show_pressure?: boolean;
  show_magnetic_activity?: boolean;
};

function hasOwn(obj: object | null | undefined, key: PropertyKey) {
  return obj ? Object.prototype.hasOwnProperty.call(obj, key) : false;
}

function normalizeSettings(settings?: WeatherSettings | null): WeatherViewSettings {
  const weather = settings as WeatherViewSettings | null | undefined;

  return {
    enabled: weather?.enabled ?? true,
    mode: weather?.mode ?? "geolocation",
    city_name: weather?.city_name ?? null,
    latitude: weather?.latitude ?? null,
    longitude: weather?.longitude ?? null,
    timezone: weather?.timezone ?? null,
    rain_alert_minutes: hasOwn(settings, "rain_alert_minutes") ? (weather?.rain_alert_minutes ?? null) : 60,
    snow_alert_minutes: hasOwn(settings, "snow_alert_minutes") ? (weather?.snow_alert_minutes ?? null) : 60,
    show_location: weather?.show_location ?? true,
    show_apparent_temperature: weather?.show_apparent_temperature ?? true,
    show_wind: weather?.show_wind ?? true,
    show_pressure: weather?.show_pressure ?? false,
    show_magnetic_activity: weather?.show_magnetic_activity ?? false,
  };
}

function isDisplayEnabled(settings: WeatherViewSettings, key: WeatherDisplayKey) {
  return settings[key] ?? true;
}

function getBrowserTimezone() {
  if (typeof window === "undefined") return "auto";
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "auto";
}

function getCurrentPosition() {
  return new Promise<{ latitude: number; longitude: number }>((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Геолокация недоступна в этом браузере."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      () => reject(new Error("Не удалось определить геопозицию. Разрешите доступ к локации.")),
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 15 * 60 * 1000,
      }
    );
  });
}

function getAlertDescription(kind: "rain" | "snow", leadMinutes: number | null | undefined) {
  if (leadMinutes == null) {
    return kind === "rain"
      ? "Предупреждения о дожде выключены."
      : "Предупреждения о снеге выключены.";
  }

  return kind === "rain"
    ? `Виджет предупредит, если дождь ожидается в ближайшие ${leadMinutes} минут.`
    : `Виджет предупредит, если снег ожидается в ближайшие ${leadMinutes} минут.`;
}

function SectionTabs({
  activeTab,
  onChange,
}: {
  activeTab: WeatherPageTab;
  onChange: (tab: WeatherPageTab) => void;
}) {
  return (
    <div className="inline-flex rounded-2xl border border-[var(--border)] bg-[var(--card)] p-1">
      {SECTION_TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`rounded-xl px-4 py-2 text-sm transition-colors ${
            activeTab === tab.id
              ? "bg-[var(--accent-soft)] text-[var(--foreground)]"
              : "text-[var(--muted)] hover:text-[var(--foreground)]"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function ToggleRow({
  title,
  description,
  enabled,
  disabled,
  onClick,
}: {
  title: string;
  description: string;
  enabled: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-left transition-colors hover:border-[var(--accent)] disabled:opacity-60"
    >
      <div className="min-w-0">
        <div className="text-sm font-medium">{title}</div>
        <div className="mt-1 text-xs leading-relaxed text-[var(--muted)]">{description}</div>
      </div>
      <span
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
          enabled ? "bg-[var(--accent)]" : "bg-white/10"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
            enabled ? "translate-x-[22px]" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}

function AlertSection({
  title,
  value,
  saving,
  onSelect,
  description,
}: {
  title: string;
  value: WeatherAlertMinutes | undefined;
  saving: boolean;
  onSelect: (nextValue: WeatherAlertMinutes) => void;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4">
      <div className="text-sm font-medium">{title}</div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {ALERT_OPTIONS.map((option) => (
          <button
            key={`${title}-${String(option.value)}`}
            type="button"
            onClick={() => onSelect(option.value)}
            disabled={saving}
            className={`whitespace-nowrap rounded-xl border px-2.5 py-1.5 text-xs transition-colors ${
              value === option.value
                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--foreground)]"
                : "border-[var(--border)] bg-[var(--card)] text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="mt-3 text-xs text-[var(--muted)]">{description}</div>
    </div>
  );
}

export default function WeatherAppPage() {
  const [settings, setSettings] = useState<WeatherViewSettings>(() => normalizeSettings());
  const [forecast, setForecast] = useState<WeatherForecast | null>(() => readWeatherCache()?.forecast ?? null);
  const [draftMode, setDraftMode] = useState<"geolocation" | "city">("geolocation");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<WeatherLocationSearchResult[]>([]);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [, setLoadingForecast] = useState(false);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<WeatherPageTab>("city");
  const forecastRef = useRef<WeatherForecast | null>(forecast);

  useEffect(() => {
    forecastRef.current = forecast;
  }, [forecast]);

  const loadForecast = useCallback(async (
    nextSettings: WeatherViewSettings,
    preferLiveGeolocation = false,
    options?: { silent?: boolean }
  ) => {
    const hasStoredCoords =
      typeof nextSettings.latitude === "number" && typeof nextSettings.longitude === "number";

    if (nextSettings.mode === "geolocation") {
      let coords = hasStoredCoords
        ? { latitude: nextSettings.latitude as number, longitude: nextSettings.longitude as number }
        : null;

      if (preferLiveGeolocation) {
        coords = await getCurrentPosition();
      }

      if (!coords) {
        return nextSettings;
      }

      if (!options?.silent && !forecastRef.current) {
        setLoadingForecast(true);
      }
      try {
        const data = await api.apps.weatherForecast({
          latitude: coords.latitude,
          longitude: coords.longitude,
          timezone: getBrowserTimezone(),
          label: null,
        });
        setForecast(data);
        writeWeatherCache(
          getWeatherSignature({
            ...nextSettings,
            mode: "geolocation",
            city_name: null,
            latitude: coords.latitude,
            longitude: coords.longitude,
            timezone: getBrowserTimezone(),
          }),
          data
        );
        setError("");
        return {
          ...nextSettings,
          city_name: null,
          latitude: coords.latitude,
          longitude: coords.longitude,
          timezone: getBrowserTimezone(),
        };
      } finally {
        setLoadingForecast(false);
      }
    }

    if (nextSettings.mode === "city" && hasStoredCoords) {
      if (!options?.silent && !forecastRef.current) {
        setLoadingForecast(true);
      }
      try {
        const data = await api.apps.weatherForecast({
          latitude: nextSettings.latitude as number,
          longitude: nextSettings.longitude as number,
          timezone: nextSettings.timezone || "auto",
          label: nextSettings.city_name,
        });
        setForecast(data);
        writeWeatherCache(getWeatherSignature(nextSettings), data);
        setError("");
        return nextSettings;
      } finally {
        setLoadingForecast(false);
      }
    }

    setForecast(null);
    return nextSettings;
  }, []);

  const refreshWeather = useCallback(
    async (nextSettings: WeatherViewSettings) => {
      if (!nextSettings.mode) return;

      try {
        const resolved = await loadForecast(nextSettings, false, { silent: true });
        setSettings((current) => normalizeSettings({ ...current, ...resolved }));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Не удалось обновить прогноз погоды.";
        setError(message);
      }
    },
    [loadForecast]
  );

  async function persistSettings(
    nextSettings: WeatherViewSettings,
    options?: { refreshForecast?: boolean; preferLiveGeolocation?: boolean }
  ) {
    setSaving(true);
    setError("");

    try {
      const resolvedSettings = options?.refreshForecast
        ? await loadForecast(nextSettings, options.preferLiveGeolocation)
        : nextSettings;

      const normalized = normalizeSettings(resolvedSettings);
      await api.apps.updateSettings({ weather: normalized });
      setSettings(normalized);
      setDraftMode(normalized.mode === "city" ? "city" : "geolocation");
      setSearchQuery(normalized.mode === "city" ? normalized.city_name || "" : "");
      setSearchResults([]);
      window.dispatchEvent(new Event("app_settings_updated"));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось сохранить погодные настройки.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function updateDisplaySetting(key: WeatherDisplayKey, value: boolean) {
    await persistSettings(
      {
        ...settings,
        [key]: value,
      },
      { refreshForecast: false }
    );
  }

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        const appSettings = await api.apps.getSettings();
        if (!active) return;

        const nextSettings = normalizeSettings(appSettings.weather);
        setSettings(nextSettings);
        setDraftMode(nextSettings.mode === "city" ? "city" : "geolocation");
        setSearchQuery(nextSettings.mode === "city" ? nextSettings.city_name || "" : "");
        const cachedWeather = readWeatherCache(getWeatherSignature(nextSettings));
        if (cachedWeather?.forecast) {
          setForecast(cachedWeather.forecast);
        }

        if (nextSettings.mode) {
          try {
            const resolved = await loadForecast(nextSettings, false, { silent: Boolean(cachedWeather?.forecast) });
            if (!active) return;
            setSettings(normalizeSettings(resolved));
          } catch (err) {
            if (!active) return;
            const message = err instanceof Error ? err.message : "Не удалось загрузить прогноз погоды.";
            setError(message);
          }
        }
      } catch (err) {
        if (!active) return;
        const message = err instanceof Error ? err.message : "Не удалось загрузить настройки погоды.";
        setError(message);
      } finally {
        if (active) {
          setLoadingSettings(false);
        }
      }
    }

    bootstrap();
    return () => {
      active = false;
    };
  }, [loadForecast]);

  useEffect(() => {
    const query = searchQuery.trim();
    const selectedCity = (settings.city_name || "").trim();

    if (draftMode !== "city" || query.length < 2 || query === selectedCity) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    let active = true;
    setSearching(true);

    const timeoutId = window.setTimeout(async () => {
      try {
        const results = await api.apps.weatherSearch(query);
        if (active) {
          setSearchResults(results);
        }
      } catch (err) {
        if (active) {
          const message = err instanceof Error ? err.message : "Не удалось найти город.";
          setError(message);
        }
      } finally {
        if (active) {
          setSearching(false);
        }
      }
    }, 300);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [draftMode, searchQuery, settings.city_name]);

  useEffect(() => {
    if (!settings.mode) {
      return;
    }

    let cancelled = false;

    const refresh = async () => {
      if (cancelled) return;
      await refreshWeather(settings);
    };

    const intervalId = window.setInterval(refresh, WEATHER_REFRESH_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [refreshWeather, settings]);

  const previewLoading = loadingSettings && !forecast;

  return (
    <div className="relative mx-auto max-w-4xl animate-fade-in p-6 pb-20">
      <Link
        href="/settings"
        className="mb-6 inline-flex items-center text-sm text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="mr-1 h-5 w-5">
          <path
            fillRule="evenodd"
            d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z"
            clipRule="evenodd"
          />
        </svg>
        К настройкам
      </Link>

      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Погода</h1>
        <p className="mt-2 text-base text-[var(--muted)]">
          Виджет над профилем обновляется автоматически. Здесь можно выбрать город, настроить сам виджет и предупреждения.
        </p>
      </header>

      {error && (
        <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {error}
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
        <section className="space-y-4">
          <SectionTabs activeTab={activeTab} onChange={setActiveTab} />

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
            {activeTab === "city" && (
              <>
                <div className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--background)] p-1">
                  <button
                    type="button"
                    onClick={() => setDraftMode("geolocation")}
                    className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                      draftMode === "geolocation"
                        ? "bg-[var(--accent-soft)] text-[var(--foreground)]"
                        : "text-[var(--muted)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    Геопозиция
                  </button>
                  <button
                    type="button"
                    onClick={() => setDraftMode("city")}
                    className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                      draftMode === "city"
                        ? "bg-[var(--accent-soft)] text-[var(--foreground)]"
                        : "text-[var(--muted)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    Добавить вручную
                  </button>
                </div>

                {draftMode === "geolocation" && (
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        persistSettings(
                          { ...settings, mode: "geolocation", city_name: null },
                          { refreshForecast: true, preferLiveGeolocation: true }
                        )
                      }
                      disabled={saving}
                      className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-60"
                    >
                      Использовать текущее место
                    </button>
                    <span className="text-sm text-[var(--muted)]">
                      {settings.latitude && settings.longitude
                        ? "Геопозиция уже сохранена."
                        : "Локация будет запрошена у браузера."}
                    </span>
                  </div>
                )}

                {draftMode === "city" && (
                  <div className="mt-4">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Введите город"
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm outline-none transition-colors focus:border-[var(--accent)]"
                    />
                    <div className="mt-2 text-xs text-[var(--muted)]">
                      {searching ? "Ищем город..." : "Начните вводить, чтобы выбрать город из списка."}
                    </div>

                    {searchQuery.trim().length > 0 &&
                      searchQuery.trim() !== (settings.city_name || "").trim() &&
                      searchResults.length > 0 && (
                        <div className="mt-3 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--background)]">
                          {searchResults.map((item) => (
                            <button
                              key={`${item.latitude}-${item.longitude}-${item.label}`}
                              type="button"
                              onClick={() => {
                                setSearchQuery(item.label);
                                setSearchResults([]);
                                persistSettings(
                                  {
                                    ...settings,
                                    mode: "city",
                                    city_name: item.label,
                                    latitude: item.latitude,
                                    longitude: item.longitude,
                                    timezone: item.timezone,
                                  },
                                  { refreshForecast: true }
                                );
                              }}
                              className="flex w-full items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3 text-left text-sm last:border-b-0 hover:bg-[var(--card-hover)]"
                            >
                              <div className="min-w-0">
                                <div className="truncate font-medium">{item.label}</div>
                                <div className="truncate text-xs text-[var(--muted)]">{item.timezone || "auto"}</div>
                              </div>
                              <div className="text-[var(--accent)]">Выбрать</div>
                            </button>
                          ))}
                        </div>
                      )}
                  </div>
                )}
              </>
            )}

            {activeTab === "display" && (
              <>
                <div className="text-sm text-[var(--muted)]">
                  Выберите, какие детали показывать внутри погодного виджета.
                </div>

                <div className="mt-4 space-y-3">
                  {DISPLAY_OPTIONS.map((option) => (
                    <ToggleRow
                      key={option.key}
                      title={option.title}
                      description={option.description}
                      enabled={isDisplayEnabled(settings, option.key)}
                      disabled={saving}
                      onClick={() => updateDisplaySetting(option.key, !isDisplayEnabled(settings, option.key))}
                    />
                  ))}
                </div>
              </>
            )}

            {activeTab === "alerts" && (
              <div className="space-y-4">
                <AlertSection
                  title="Дождь"
                  value={settings.rain_alert_minutes}
                  saving={saving}
                  onSelect={(value) =>
                    persistSettings(
                      {
                        ...settings,
                        rain_alert_minutes: value,
                      },
                      { refreshForecast: false }
                    )
                  }
                  description={getAlertDescription("rain", settings.rain_alert_minutes)}
                />

                <AlertSection
                  title="Снег"
                  value={settings.snow_alert_minutes}
                  saving={saving}
                  onSelect={(value) =>
                    persistSettings(
                      {
                        ...settings,
                        snow_alert_minutes: value,
                      },
                      { refreshForecast: false }
                    )
                  }
                  description={getAlertDescription("snow", settings.snow_alert_minutes)}
                />
              </div>
            )}
          </div>
        </section>

        <aside className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 lg:sticky lg:top-6">
          <div className="text-sm font-medium">Превью виджета</div>
          <div className="mt-4 max-w-[224px]">
            <WeatherWidgetCard settings={settings} forecast={forecast} loading={previewLoading} error={error} />
          </div>
        </aside>
      </div>
    </div>
  );
}
