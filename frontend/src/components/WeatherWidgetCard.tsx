"use client";

import Link from "next/link";
import { type ReactNode } from "react";

import type { WeatherForecast, WeatherSettings } from "@/lib/api";
import { formatTemp, getRainSummary, getWeatherIcon, resolveLocationLabel } from "@/lib/weather";

type WeatherWidgetViewSettings = WeatherSettings & {
  show_location?: boolean;
  show_apparent_temperature?: boolean;
  show_wind?: boolean;
  show_pressure?: boolean;
  show_magnetic_activity?: boolean;
};

function formatPressure(value: number | null | undefined) {
  if (value == null) return null;
  const mmHg = Math.round(value * 0.75006156);
  return `${mmHg} мм`;
}

function formatMagneticValue(
  magneticActivity: WeatherForecast["magnetic_activity"] | null | undefined
) {
  if (!magneticActivity || magneticActivity.kp_index == null) return null;
  return magneticActivity.kp_index.toFixed(1);
}

function getAlertWindowLabel(leadMinutes: number) {
  if (leadMinutes === 30) return "30 мин";
  if (leadMinutes === 60) return "1 час";
  if (leadMinutes === 120) return "2 часа";
  if (leadMinutes === 240) return "4 часа";
  if (leadMinutes === 720) return "12 часов";
  return `${leadMinutes} мин`;
}

function getRainStatusText(
  rainSummary: ReturnType<typeof getRainSummary> | null,
  leadMinutes: number | null | undefined
) {
  if (leadMinutes == null || !rainSummary) return null;
  const prefix = getAlertWindowLabel(leadMinutes);
  const rainExpected = rainSummary.tone === "warning";
  return rainExpected ? `${prefix} • ожидается` : `${prefix} • без дождя`;
}

function isSnowCode(code?: number | null) {
  if (code == null) return false;
  return [71, 73, 75, 77, 85, 86].includes(code);
}

function getSnowSummary(forecast: WeatherForecast | null, leadMinutes: number | null | undefined) {
  if (leadMinutes == null || !forecast) return null;

  const now = forecast.current.time ?? Math.floor(Date.now() / 1000);

  if (isSnowCode(forecast.current.weather_code)) {
    return {
      expected: true,
      text: `${getAlertWindowLabel(leadMinutes)} • ожидается`,
    };
  }

  const minutelyPoint = forecast.minutely.find(
    (point) => point.time >= now && isSnowCode(point.weather_code)
  );
  if (minutelyPoint) {
    const diffMinutes = Math.max(0, Math.round((minutelyPoint.time - now) / 60));
    if (diffMinutes <= leadMinutes) {
      return {
        expected: true,
        text: `${getAlertWindowLabel(leadMinutes)} • ожидается`,
      };
    }
  }

  const hourlyPoint = forecast.hourly.find(
    (point) => point.time >= now && isSnowCode(point.weather_code)
  );
  if (hourlyPoint) {
    const diffMinutes = Math.max(0, Math.round((hourlyPoint.time - now) / 60));
    if (diffMinutes <= leadMinutes) {
      return {
        expected: true,
        text: `${getAlertWindowLabel(leadMinutes)} • ожидается`,
      };
    }
  }

  return {
    expected: false,
    text: `${getAlertWindowLabel(leadMinutes)} • без снега`,
  };
}

function RainStatusIcon({ active }: { active: boolean }) {
  return (
    <span className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center">
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
        <path
          d="M6 8.75a4 4 0 0 1 7.68-1.56A3.25 3.25 0 1 1 14.75 13H6.5a2.5 2.5 0 0 1-.5-4.25Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M7.5 14.5l-.5 1.5M10 14.5l-.5 1.5M12.5 14.5l-.5 1.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      {!active ? (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="h-[1.5px] w-5 rotate-[-38deg] rounded-full bg-current" />
        </span>
      ) : null}
    </span>
  );
}

function SnowStatusIcon({ active }: { active: boolean }) {
  return (
    <span className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center">
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
        <path
          d="M10 3.5v13M5.5 6l9 8M14.5 6l-9 8M4 10h12"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      {!active ? (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="h-[1.5px] w-5 rotate-[-38deg] rounded-full bg-current" />
        </span>
      ) : null}
    </span>
  );
}

function AlertBadge({
  active,
  icon,
  text,
}: {
  active: boolean;
  icon: ReactNode;
  text: string;
}) {
  const className = active
    ? "border-amber-500/20 bg-amber-500/10 text-[var(--foreground)]"
    : "border-white/10 bg-black/10 text-[var(--muted)]";

  return (
    <div className={`mt-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${className}`}>
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0 truncate">{text}</span>
    </div>
  );
}

const weatherIcon = (
  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
    <path d="M9.5 2.75a.75.75 0 0 1 .75.75v.769a.75.75 0 0 1-1.5 0V3.5a.75.75 0 0 1 .75-.75ZM4.27 4.27a.75.75 0 0 1 1.06 0l.544.543a.75.75 0 1 1-1.06 1.061l-.544-.544a.75.75 0 0 1 0-1.06Zm10.4 0a.75.75 0 0 1 0 1.06l-.544.544a.75.75 0 1 1-1.06-1.06l.543-.544a.75.75 0 0 1 1.061 0ZM9.5 5.75a4 4 0 1 0 2.575 7.062.75.75 0 0 1 .97 1.144A5.5 5.5 0 1 1 15 9.75a.75.75 0 0 1-1.5 0A4 4 0 0 0 9.5 5.75Zm6 6a2.75 2.75 0 0 1 .303 5.483l-.136.007H12a.75.75 0 0 1 0-1.5h3.667a1.25 1.25 0 1 0 0-2.5h-.211a.75.75 0 0 1-.72-.953A1.999 1.999 0 0 0 12.8 9.75a2 2 0 0 0-1.55.737.75.75 0 1 1-1.157-.955A3.5 3.5 0 0 1 16.25 11.75h-.75Z" />
  </svg>
);

function WidgetShell({
  children,
  href,
  onClick,
}: {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
}) {
  const className =
    "block rounded-2xl border border-[var(--border)] bg-[linear-gradient(160deg,rgba(56,189,248,0.14),rgba(15,23,42,0.08))] p-3 transition-colors";

  if (href) {
    return (
      <Link href={href} onClick={onClick} className={`${className} hover:border-[var(--accent)]`}>
        {children}
      </Link>
    );
  }

  return <div className={className}>{children}</div>;
}

export function WeatherWidgetCard({
  settings,
  forecast,
  loading,
  error,
  href,
  onClick,
}: {
  settings?: WeatherSettings;
  forecast: WeatherForecast | null;
  loading: boolean;
  error: string;
  href?: string;
  onClick?: () => void;
}) {
  const widgetSettings = settings as WeatherWidgetViewSettings | undefined;
  const isConfigured = Boolean(
    widgetSettings?.mode &&
      typeof widgetSettings.latitude === "number" &&
      typeof widgetSettings.longitude === "number"
  );
  const showLocation = widgetSettings?.show_location ?? true;
  const showApparentTemperature = widgetSettings?.show_apparent_temperature ?? true;
  const showWind = widgetSettings?.show_wind ?? true;
  const showPressure = widgetSettings?.show_pressure ?? false;
  const showMagneticActivity = widgetSettings?.show_magnetic_activity ?? false;

  if (!isConfigured) {
    return (
      <WidgetShell href={href} onClick={onClick}>
        <div className="flex items-center gap-2 text-sm font-medium">
          {weatherIcon}
          Погода
        </div>
        <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
          Добавьте город или включите геолокацию, и здесь появится текущая погода над профилем.
        </p>
        {href ? (
          <div className="mt-3 inline-flex items-center rounded-xl bg-[var(--accent)] px-3 py-2 text-xs font-medium text-white">
            Настроить виджет
          </div>
        ) : null}
      </WidgetShell>
    );
  }

  if (loading && !forecast) {
    return (
      <WidgetShell href={href} onClick={onClick}>
        <div className="text-sm font-medium">Загружаем погоду...</div>
        <div className="mt-2 text-xs text-[var(--muted)]">
          Получаем текущий прогноз для выбранной локации.
        </div>
      </WidgetShell>
    );
  }

  if (!forecast) {
    return (
      <WidgetShell href={href} onClick={onClick}>
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
          <div className="text-sm font-medium">Погода временно недоступна</div>
          <div className="mt-2 text-xs text-[var(--muted)]">
            {error || "Откройте настройки погоды и проверьте локацию."}
          </div>
        </div>
      </WidgetShell>
    );
  }

  const rainSummary =
    widgetSettings?.rain_alert_minutes == null
      ? null
      : getRainSummary(forecast, widgetSettings.rain_alert_minutes);
  const label = resolveLocationLabel(forecast, widgetSettings?.city_name);
  const showDetails = showWind || showPressure || showMagneticActivity;
  const pressureLabel = formatPressure(forecast.current.pressure_msl);
  const magneticValue = formatMagneticValue(forecast.magnetic_activity);
  const rainExpected = Boolean(rainSummary?.tone === "warning");
  const rainStatusText = getRainStatusText(rainSummary, widgetSettings?.rain_alert_minutes);
  const snowSummary = getSnowSummary(forecast, widgetSettings?.snow_alert_minutes);

  return (
    <WidgetShell href={href} onClick={onClick}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium">Погода</div>
          {showLocation ? (
            <div className="mt-1 truncate text-xs text-[var(--muted)]">{label}</div>
          ) : null}
        </div>
        <div className="text-2xl">
          {getWeatherIcon(forecast.current.weather_code, forecast.current.is_day === 1)}
        </div>
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <div className="flex items-end gap-2">
            <div className="text-3xl font-semibold leading-none">
              {formatTemp(forecast.current.temperature_2m)}
            </div>
            {showApparentTemperature ? (
              <div className="pb-0.5 text-xs text-[var(--muted)]">
                Ощущается {formatTemp(forecast.current.apparent_temperature)}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {showDetails ? (
        <div className="mt-3 space-y-1.5 text-xs text-[var(--muted)]">
          {showWind ? (
            <div className="flex items-center justify-between gap-3">
              <span>Ветер</span>
              <span className="text-[var(--foreground)]">
                {Math.round(forecast.current.wind_speed_10m || 0)} км/ч
              </span>
            </div>
          ) : null}
          {showPressure && pressureLabel ? (
            <div className="flex items-center justify-between gap-3">
              <span>Давление</span>
              <span className="text-right text-[var(--foreground)]">{pressureLabel}</span>
            </div>
          ) : null}
          {showMagneticActivity && magneticValue ? (
            <div className="flex items-center justify-between gap-3">
              <span>Магнитный фон</span>
              <span className="text-right text-[var(--foreground)]">{magneticValue}</span>
            </div>
          ) : null}
        </div>
      ) : null}

      {rainStatusText ? (
        <AlertBadge
          active={rainExpected}
          icon={<RainStatusIcon active={rainExpected} />}
          text={rainStatusText}
        />
      ) : null}

      {snowSummary ? (
        <AlertBadge
          active={snowSummary.expected}
          icon={<SnowStatusIcon active={snowSummary.expected} />}
          text={snowSummary.text}
        />
      ) : null}
    </WidgetShell>
  );
}
