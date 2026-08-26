// Client-side helper for reading Mission Control data through the
// /api/mc/* proxy. Keeps MC_URL + MC_AUTH_TOKEN server-side.

export interface McError {
  error?: string;
  detail?: string;
}

export async function mcGet(path: string): Promise<unknown> {
  const res = await fetch(`/api/mc/${path}`, { cache: "no-store" });
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