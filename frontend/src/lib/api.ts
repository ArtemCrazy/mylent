const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };
  const res = await fetch(`${API_BASE}/api${path}`, { ...options, headers });
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
    create: (body: { type: string; title: string; slug: string; category?: string; url?: string; config_json?: string }) =>
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
      request<Digest>("/digests/generate", { method: "POST", body: JSON.stringify(body) }),
  },
  settings: {
    get: () => request<Settings>("/settings"),
    update: (body: Partial<Settings>) =>
      request<Settings>("/settings", { method: "PATCH", body: JSON.stringify(body) }),
  },
};

export interface Source {
  id: number;
  type: string;
  title: string;
  slug: string;
  category: string | null;
  url: string | null;
  is_active: boolean;
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
}

export interface Digest {
  id: number;
  type: string;
  title: string;
  period_start: string;
  period_end: string;
  summary: string | null;
  items_json: string;
  created_at: string;
}

export interface Settings {
  theme: string;
  ai_summary_enabled: boolean;
  digest_enabled: boolean;
  sync_interval_minutes: number;
}
