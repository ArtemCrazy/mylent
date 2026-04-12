const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
const FETCH_TIMEOUT_MS = 15_000;
const FETCH_TIMEOUT_LONG_MS = 60_000;

/** Convert backend-relative media path (e.g. /media/1/123.jpg) to full URL */
export function getMediaUrl(path: string): string {
  if (path.startsWith("http")) return path;
  return `${API_BASE}${path}`;
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  timeoutMs = FETCH_TIMEOUT_MS
): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timeoutId);
    if (e instanceof Error) {
      if (e.name === "AbortError") throw new Error("Сервер не отвечает. Проверьте, что backend запущен на " + API_BASE.replace(/^https?:\/\//, ""));
      const isNetworkError = e.message === "Failed to fetch" || e.message === "Load failed" || e.message?.includes("NetworkError");
      if (isNetworkError) {
        const host = API_BASE.replace(/^https?:\/\//, "").replace(/\/$/, "");
        throw new Error(`Нет связи с API (${host}). Запустите backend: в папке backend выполните «uvicorn app.main:app --reload --port 8000».`);
      }
      throw new Error(e.message || "Ошибка сети");
    }
    throw e;
  }
  clearTimeout(timeoutId);
  if (res.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    throw new Error("Not authenticated");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const detail = err.detail;
    const msg =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail) && detail[0]?.msg
          ? detail[0].msg
          : typeof detail === "object" && detail !== null
            ? (detail as { msg?: string }).msg || JSON.stringify(detail)
            : "Request failed";
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  _request: request,
  auth: {
    login: (login: string, password: string) =>
      request<{ access_token: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ login, password }),
      }),
    me: () => request<{ id: number; email: string }>("/auth/me"),
  },
  sources: {
    list: () => request<Source[]>("/sources"),
    channelPreview: (username: string) =>
      request<{ has_public_link: boolean; avatar_base64: string | null }>(`/sources/channel-preview?username=${encodeURIComponent(username)}`),
    create: (body: { type: string; title: string; slug: string; category?: string; url?: string; config_json?: string; show_in_feed?: boolean }) =>
      request<Source>("/sources", { method: "POST", body: JSON.stringify(body) }),
    update: (id: number, body: Partial<Source>) =>
      request<Source>(`/sources/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    delete: (id: number) => request<void>(`/sources/${id}`, { method: "DELETE" }),
  },
  posts: {
    list: (params?: Record<string, string | number | boolean | undefined>) => {
      const sp = new URLSearchParams();
      if (params) Object.entries(params).forEach(([k, v]) => v !== undefined && sp.set(k, String(v)));
      return request<Post[]>(`/posts?${sp}`);
    },
    get: (id: number) => request<Post>(`/posts/${id}`),
    favorite: (id: number) => request<Post>(`/posts/${id}/favorite`, { method: "POST" }),
    hide: (id: number) => request<Post>(`/posts/${id}/hide`, { method: "POST" }),
    archive: (id: number) => request<Post>(`/posts/${id}/archive`, { method: "POST" }),
    read: (id: number) => request<Post>(`/posts/${id}/read`, { method: "POST" }),
  },
  search: (q: string, params?: { source_id?: number; limit?: number }) => {
    const sp = new URLSearchParams({ q });
    if (params?.source_id != null) sp.set("source_id", String(params.source_id));
    if (params?.limit != null) sp.set("limit", String(params.limit));
    return request<Post[]>(`/search?${sp}`);
  },
  digests: {
    list: (type?: string) =>
      request<Digest[]>(type ? `/digests?type=${type}` : "/digests"),
    get: (id: number) => request<Digest>(`/digests/${id}`),
    generate: (body: { type: string; period_start?: string; period_end?: string }) =>
      request<Digest>("/digests/generate", { method: "POST", body: JSON.stringify(body) }, FETCH_TIMEOUT_LONG_MS),
  },
  digestConfigs: {
    list: () => request<DigestConfig[]>("/digests/configs"),
    get: (id: number) => request<DigestConfig>(`/digests/configs/${id}`),
    create: (body: {
      name: string; prompt: string; schedule_type?: string;
      schedule_hours?: string; period_hours?: number; source_ids?: number[];
    }) => request<DigestConfig>("/digests/configs", { method: "POST", body: JSON.stringify(body) }),
    update: (id: number, body: {
      name?: string; prompt?: string; schedule_type?: string;
      schedule_hours?: string; period_hours?: number;
      is_active?: boolean; source_ids?: number[];
    }) => request<DigestConfig>(`/digests/configs/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    delete: (id: number) => request<void>(`/digests/configs/${id}`, { method: "DELETE" }),
    generate: (id: number) =>
      request<Digest>(`/digests/configs/${id}/generate`, { method: "POST" }, FETCH_TIMEOUT_LONG_MS),
    history: (id: number, params?: { limit?: number; offset?: number }) => {
      const sp = new URLSearchParams();
      if (params?.limit) sp.set("limit", String(params.limit));
      if (params?.offset) sp.set("offset", String(params.offset));
      return request<Digest[]>(`/digests/configs/${id}/history?${sp}`);
    },
  },
  settings: {
    get: () => request<Settings>("/settings"),
    update: (body: Partial<Settings>) =>
      request<Settings>("/settings", { method: "PATCH", body: JSON.stringify(body) }),
  },
  signals: {
    globalFeed: () => request<{ feed: GlobalSignalFeedItem[] }>("/signals/global-feed"),
    list: () => request<Signal[]>("/signals"),
    get: (id: number) => request<Signal>(`/signals/${id}`),
    create: (body: { name: string; type?: string; source_ids?: number[]; assets?: { name: string; ticker?: string; keywords: string }[] }) =>
      request<Signal>("/signals", { method: "POST", body: JSON.stringify(body) }),
    update: (id: number, body: { name?: string; is_active?: boolean; source_ids?: number[] }) =>
      request<Signal>(`/signals/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    delete: (id: number) => request<void>(`/signals/${id}`, { method: "DELETE" }),
    addAsset: (signalId: number, body: { name: string; ticker?: string; keywords: string }) =>
      request<SignalAsset>(`/signals/${signalId}/assets`, { method: "POST", body: JSON.stringify(body) }),
    deleteAsset: (signalId: number, assetId: number) =>
      request<void>(`/signals/${signalId}/assets/${assetId}`, { method: "DELETE" }),
    alerts: (signalId: number, params?: { limit?: number; offset?: number }) => {
      const sp = new URLSearchParams();
      if (params?.limit) sp.set("limit", String(params.limit));
      if (params?.offset) sp.set("offset", String(params.offset));
      return request<SignalAlert[]>(`/signals/${signalId}/alerts?${sp}`);
    },
    markAllRead: (signalId: number) =>
      request<void>(`/signals/${signalId}/alerts/read-all`, { method: "POST" }),
    unreadCount: () => request<{ count: number }>("/signals/alerts/unread-count"),
  },
  telegram: {
    status: () =>
      request<{ authorized: boolean; has_credentials: boolean; error?: string }>("/telegram/status"),
    sendPhone: (phone: string) =>
      request<{ ok: boolean; message: string }>("/telegram/auth/phone", {
        method: "POST",
        body: JSON.stringify({ phone }),
      }, FETCH_TIMEOUT_LONG_MS),
    sendCode: (phone: string, code: string, password?: string) =>
      request<{ ok: boolean; message: string }>("/telegram/auth/code", {
        method: "POST",
        body: JSON.stringify({ phone, code, ...(password ? { password } : {}) }),
      }, FETCH_TIMEOUT_LONG_MS),
  },
  apps: {
    getSettings: () => request<AppSettings>("/apps/settings"),
    footballFixtures: (date?: string) =>
      request<unknown[]>(`/apps/football/fixtures${date ? `?date=${date}` : ""}`),
    weatherSearch: (q: string) =>
      request<WeatherLocationSearchResult[]>(`/apps/weather/search?q=${encodeURIComponent(q)}`),
    weatherForecast: (params: {
      latitude: number;
      longitude: number;
      timezone?: string | null;
      label?: string | null;
    }) => {
      const sp = new URLSearchParams({
        latitude: String(params.latitude),
        longitude: String(params.longitude),
      });
      if (params.timezone) sp.set("timezone", params.timezone);
      if (params.label) sp.set("label", params.label);
      return request<WeatherForecast>(`/apps/weather/forecast?${sp}`);
    },
    updateSettings: (updates: Partial<AppSettings>) =>
      request<{ status: string; settings: AppSettings }>("/apps/settings", { method: "PATCH", body: JSON.stringify(updates) }),
  },
  investments: {
    portfolio: () => request<{ portfolio?: unknown[], signals?: unknown[] }>("/investments/portfolio"),
    addToPortfolio: (body: { secid: string, isin: string, name: string, shortname: string, quantity: number, average_price: number | null }) => request<void>("/investments/portfolio", { method: "POST", body: JSON.stringify(body) }),
    removeFromPortfolio: (id: number) => request<void>(`/investments/portfolio/${id}`, { method: "DELETE" }),
    signals: () => request<{ signals?: unknown[] }>("/investments/signals"),
    addSignal: (body: { bond_id: number, condition_type: string, target_value: number, news_category?: string, cron_minutes?: number, notify_telegram?: boolean }) => request<void>("/investments/signals", { method: "POST", body: JSON.stringify(body) }),
    addSignalBulk: (body: { bond_ids: number[], condition_type: string, target_value: number | null, news_category?: string, cron_minutes?: number, notify_telegram?: boolean }) => request<{status: string, created: number}>("/investments/signals/bulk", { method: "POST", body: JSON.stringify(body) }),
    updateSignal: (id: number, body: { condition_type?: string, target_value?: number | null, news_category?: string, cron_minutes?: number, notify_telegram?: boolean, is_active?: boolean }) => request<void>(`/investments/signals/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    removeSignal: (id: number) => request<void>(`/investments/signals/${id}`, { method: "DELETE" }),
    getBondSignalFeed: (id: number) => request<{ feed: BondSignalAlert[] }>(`/investments/signals/${id}/feed`),
    markBondSignalRead: (id: number) => request<void>(`/investments/signals/${id}/read`, { method: "POST" }),
    search: (q: string) => request<{ results?: [string, string, string, string][] }>(`/investments/search?q=${encodeURIComponent(q)}`),
  },
};

export interface BondSignalAlert {
  id: number;
  message: string | null;
  is_read: boolean;
  created_at: string;
  post: {
    id: number;
    text: string;
    url: string | null;
    original_url: string | null;
    source_title: string;
    source_slug: string;
    created_at: string;
    media_files: { url: string; type: string }[];
  } | null;
}

export interface Source {
  id: number;
  type: string;
  title: string;
  slug: string;
  category: string | null;
  url: string | null;
  is_active: boolean;
  show_in_feed: boolean;
  priority: number;
  config_json: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AIAnalysis {
  id: number;
  summary: string | null;
  main_topic: string | null;
  tags_json: string | null;
  importance_score: number | null;
  business_relevance_score: number | null;
  reason_for_relevance: string | null;
  digest_candidate: boolean;
  processed_at: string | null;
}

export interface PostSourceRef {
  id: number;
  title: string;
  type: string;
  category: string | null;
  config_json: string | null;
}

export interface Post {
  id: number;
  source_id: number;
  external_id: string;
  title: string | null;
  raw_text: string;
  cleaned_text: string | null;
  preview_text: string | null;
  original_url: string | null;
  published_at: string;
  imported_at: string;
  updated_at: string;
  media_json: string | null;
  language: string | null;
  read_status: string;
  is_favorite: boolean;
  is_hidden: boolean;
  is_archived: boolean;
  ai_analysis: AIAnalysis | null;
  source: PostSourceRef | null;
}

export interface Digest {
  id: number;
  config_id: number | null;
  config_name: string | null;
  type: string;
  title: string;
  period_start: string;
  period_end: string;
  summary: string | null;
  items_json: string;
  created_at: string;
}

export interface DigestConfig {
  id: number;
  name: string;
  prompt: string;
  schedule_type: string;
  schedule_hours: string | null;
  period_hours: number;
  is_active: boolean;
  created_at: string;
  sources: SignalSourceRef[];
  last_digest: Digest | null;
  digest_count: number;
}

export interface WeatherSettings {
  enabled?: boolean;
  mode?: "geolocation" | "city" | null;
  city_name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  timezone?: string | null;
  rain_alert_minutes?: 30 | 60 | 120 | 240 | 720 | null;
  snow_alert_minutes?: 30 | 60 | 120 | 240 | 720 | null;
  show_location?: boolean;
  show_apparent_temperature?: boolean;
  show_wind?: boolean;
  show_pressure?: boolean;
  show_magnetic_activity?: boolean;
}

export interface AppSettings {
  football_leagues?: string[];
  weather?: WeatherSettings;
}

export interface WeatherLocationSearchResult {
  name: string;
  country: string | null;
  admin1: string | null;
  latitude: number;
  longitude: number;
  timezone: string | null;
  label: string;
}

export interface WeatherCurrent {
  time: number | null;
  temperature_2m: number | null;
  apparent_temperature: number | null;
  weather_code: number | null;
  is_day: number | null;
  wind_speed_10m: number | null;
  pressure_msl: number | null;
  precipitation: number | null;
  rain: number | null;
  showers: number | null;
}

export interface WeatherHourlyPoint {
  time: number;
  temperature_2m: number | null;
  precipitation_probability: number | null;
  precipitation: number | null;
  rain: number | null;
  showers: number | null;
  weather_code: number | null;
  is_day: number | null;
  pressure_msl: number | null;
}

export interface WeatherMinutelyPoint {
  time: number;
  temperature_2m: number | null;
  precipitation: number | null;
  rain: number | null;
  showers: number | null;
  weather_code: number | null;
  is_day: number | null;
}

export interface WeatherDailyPoint {
  time: number;
  weather_code: number | null;
  temperature_2m_max: number | null;
  temperature_2m_min: number | null;
  precipitation_probability_max: number | null;
  precipitation_sum: number | null;
}

export interface WeatherForecast {
  location: {
    label: string | null;
    latitude: number;
    longitude: number;
    timezone: string;
    timezone_abbreviation: string | null;
  };
  current: WeatherCurrent;
  hourly: WeatherHourlyPoint[];
  minutely: WeatherMinutelyPoint[];
  daily: WeatherDailyPoint[];
  magnetic_activity: {
    kp_index: number | null;
    level: string | null;
    scale: string | null;
    updated_at: string | null;
  } | null;
  updated_at: number;
}

export interface Settings {
  theme: string;
  ai_summary_enabled: boolean;
  digest_enabled: boolean;
  sync_interval_minutes: number;
}

export interface SignalAsset {
  id: number;
  name: string;
  ticker: string | null;
  keywords: string;
}

export interface SignalSourceRef {
  id: number;
  title: string;
  category: string | null;
}

export interface Signal {
  id: number;
  name: string;
  type: string;
  is_active: boolean;
  created_at: string;
  sources: SignalSourceRef[];
  assets: SignalAsset[];
  unread_count: number;
}

export interface SignalAlertPost {
  id: number;
  title: string | null;
  preview_text: string | null;
  original_url: string | null;
  published_at: string;
  source_title: string | null;
}

export interface SignalAlert {
  id: number;
  signal_id: number;
  matched_keyword: string;
  is_read: boolean;
  created_at: string;
  asset: SignalAsset;
  post: SignalAlertPost;
}

export interface GlobalSignalFeedItem {
  global_id: string;
  type: "text" | "bond";
  db_id: number;
  signal_id: number;
  is_read: boolean;
  created_at: string;
  origin_name: string;
  asset_name: string | null;
  message: string | null;
  post: {
    id: number;
    text: string;
    url: string | null;
    original_url: string | null;
    source_title: string;
    source_slug: string;
    created_at: string;
    media_files: { url: string; type: string }[];
  } | null;
}
