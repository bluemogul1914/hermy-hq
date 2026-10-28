// Client-side helper for reading Mission Control data through the
// /api/mc/* proxy. Keeps MC_URL + MC_AUTH_TOKEN server-side.

export interface McError {
  error?: string;
  detail?: string;
}

export async function mcGet<T = unknown>(path: string): Promise<T> {
  const p = path.startsWith("/") ? path.slice(1) : path;
  const res = await fetch(`/api/mc/${p}`, { cache: "no-store" });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const j = (await res.json()) as McError;
      detail = j.error || detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return res.json();
}

export async function mcGetSafe<T>(path: string): Promise<T | null> {
  try {
    return (await mcGet(path)) as T;
  } catch {
    return null;
  }
}

export async function mcPost(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`/api/mc/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const j = (await res.json()) as McError;
      detail = j.error || detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return res.json();
}

export async function mcPostSafe<T>(path: string, body: unknown): Promise<T | null> {
  try {
    return (await mcPost(path, body)) as T;
  } catch {
    return null;
  }
}