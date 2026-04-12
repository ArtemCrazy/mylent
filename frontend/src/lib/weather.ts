import type { WeatherForecast, WeatherHourlyPoint, WeatherMinutelyPoint } from "@/lib/api";

type RainPoint = Pick<WeatherMinutelyPoint, "time" | "precipitation" | "rain" | "showers" | "weather_code">;
type HourPoint = Pick<WeatherHourlyPoint, "time" | "precipitation" | "rain" | "showers" | "weather_code">;

const WEATHER_LABELS: Record<number, string> = {
  0: "Ясно",
  1: "Почти ясно",
  2: "Переменная облачность",
  3: "Пасмурно",
  45: "Туман",
  48: "Изморозь",
  51: "Легкая морось",
  53: "Морось",
  55: "Сильная морось",
  56: "Ледяная морось",
  57: "Сильная ледяная морось",
  61: "Небольшой дождь",
  63: "Дождь",
  65: "Сильный дождь",
  66: "Ледяной дождь",
  67: "Сильный ледяной дождь",
  71: "Небольшой снег",
  73: "Снег",
  75: "Сильный снег",
  77: "Снежные зерна",
  80: "Ливень",
  81: "Ливень",
  82: "Сильный ливень",
  85: "Снежный заряд",
  86: "Сильный снежный заряд",
  95: "Гроза",
  96: "Гроза с градом",
  99: "Сильная гроза с градом",
};

function isRainCode(code?: number | null) {
  if (code == null) return false;
  return [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(code);
}

function hasPrecipitation(point?: RainPoint | HourPoint | null) {
  if (!point) return false;
  const total =
    Number(point.precipitation ?? 0) +
    Number(point.rain ?? 0) +
    Number(point.showers ?? 0);
  return total > 0.1 || isRainCode(point.weather_code);
}

export function getWeatherLabel(code?: number | null) {
  if (code == null) return "Нет данных";
  return WEATHER_LABELS[code] || "Погода";
}

export function getWeatherIcon(code?: number | null, isDay = true) {
  if (code == null) return "🌤️";
  if (code === 0) return isDay ? "☀️" : "🌙";
  if ([1, 2].includes(code)) return isDay ? "⛅" : "☁️";
  if (code === 3) return "☁️";
  if ([45, 48].includes(code)) return "🌫️";
  if ([51, 53, 55, 56, 57].includes(code)) return "🌦️";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "🌧️";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "🌨️";
  if ([95, 96, 99].includes(code)) return "⛈️";
  return "🌤️";
}

export function formatTemp(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return "--";
  return `${Math.round(value)}°`;
}

export function formatPrecipitation(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return "0 мм";
  return `${value.toFixed(value >= 10 ? 0 : 1)} мм`;
}

export function formatTime(timestamp?: number | null, timezone?: string | null) {
  if (!timestamp) return "--:--";
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone || "UTC",
  }).format(new Date(timestamp * 1000));
}

export function formatDay(timestamp?: number | null, timezone?: string | null) {
  if (!timestamp) return "";
  return new Intl.DateTimeFormat("ru-RU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: timezone || "UTC",
  })
    .format(new Date(timestamp * 1000))
    .replace(".", "");
}

export function resolveLocationLabel(forecast?: WeatherForecast | null, fallback?: string | null) {
  return forecast?.location.label || fallback || "Текущая погода";
}

export function getRainSummary(forecast?: WeatherForecast | null, leadMinutes = 60) {
  if (!forecast) {
    return {
      tone: "idle" as const,
      title: "Погода не загружена",
      subtitle: "Выберите город или включите геолокацию.",
      startsInMinutes: null,
      nextRainTime: null as number | null,
    };
  }

  const now = forecast.current.time ?? Math.floor(Date.now() / 1000);
  const currentPoint = {
    time: now,
    precipitation: forecast.current.precipitation,
    rain: forecast.current.rain,
    showers: forecast.current.showers,
    weather_code: forecast.current.weather_code,
  };

  if (hasPrecipitation(currentPoint)) {
    return {
      tone: "warning" as const,
      title: "Сейчас возможен дождь",
      subtitle: "Лучше взять зонт перед выходом.",
      startsInMinutes: 0,
      nextRainTime: now,
    };
  }

  const minutelyPoint = forecast.minutely.find((point) => point.time >= now && hasPrecipitation(point));
  if (minutelyPoint) {
    const diffMinutes = Math.max(0, Math.round((minutelyPoint.time - now) / 60));
    if (diffMinutes <= leadMinutes) {
      return {
        tone: "warning" as const,
        title: `Дождь через ${diffMinutes} мин`,
        subtitle: `Предупреждение сработало по окну ${leadMinutes} минут.`,
        startsInMinutes: diffMinutes,
        nextRainTime: minutelyPoint.time,
      };
    }

    return {
      tone: "muted" as const,
      title: "Осадки позже",
      subtitle: `Ориентировочно в ${formatTime(minutelyPoint.time, forecast.location.timezone)}.`,
      startsInMinutes: diffMinutes,
      nextRainTime: minutelyPoint.time,
    };
  }

  const hourlyPoint = forecast.hourly.find((point) => point.time >= now && hasPrecipitation(point));
  if (hourlyPoint) {
    const diffMinutes = Math.max(0, Math.round((hourlyPoint.time - now) / 60));
    if (diffMinutes <= leadMinutes) {
      return {
        tone: "warning" as const,
        title: `Осадки через ${diffMinutes} мин`,
        subtitle: "Точный 15-минутный прогноз недоступен, используем почасовой.",
        startsInMinutes: diffMinutes,
        nextRainTime: hourlyPoint.time,
      };
    }

    return {
      tone: "muted" as const,
      title: "Ближайшие часы сухо",
      subtitle: `Следующие осадки ожидаются после ${formatTime(hourlyPoint.time, forecast.location.timezone)}.`,
      startsInMinutes: diffMinutes,
      nextRainTime: hourlyPoint.time,
    };
  }

  return {
    tone: "success" as const,
    title: "Ближайшие часы без дождя",
    subtitle: "Можно планировать выход без зонта.",
    startsInMinutes: null,
    nextRainTime: null,
  };
}
