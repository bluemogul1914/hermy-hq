import { NextRequest, NextResponse } from "next/server";

// ─────────────────────────────────────────────────────────────────────────────
// Blue Mogul AI · Mission Control proxy (v2 — full feature surface)
//
// Forwards ALL Mission Control API paths through this route. The MC shared
// token lives ONLY server-side (env MC_URL + MC_AUTH_TOKEN) and is never
// sent to the browser. The browser calls this route (already behind
// NextAuth Google OAuth) and we attach the x-mc-token header server-side.
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MC_BASE = process.env.MC_URL || "https://mission-control.bluemogul.us";
const MC_TOKEN = process.env.MC_AUTH_TOKEN || "";
const TERMINAL_PASSWORD = process.env.TERMINAL_PASSWORD || "changeme";

// Paths that must NEVER be proxied (auth/session management handled by NextAuth)
const BLOCKED = new Set([
  "session",
  "login",
  "logout",
  "auth",
  "oauth",
  "callback",
]);

function isBlocked(rel: string): boolean {
  return BLOCKED.has(rel) || BLOCKED.has(rel.split("/")[0]);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const rel = path.join("/");

  if (isBlocked(rel)) {
    return NextResponse.json(
      { error: `proxy for /api/mc/${rel} is blocked` },
      { status: 403 }
    );
  }

  let body: unknown = {};
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      body = await req.json();
    } catch {
      /* empty body ok */
    }
  }

  // Inject server-side terminal password so the frontend never sees it
  if (rel.startsWith("terminal/")) {
    body = { ...(typeof body === "object" && body ? body : {}), password: TERMINAL_PASSWORD };
  }

  const url = `${MC_BASE}/api/${rel}`;
  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-mc-token": MC_TOKEN,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const text = await upstream.text();
    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Mission Control upstream returned ${upstream.status}`, detail: text },
        { status: upstream.status }
      );
    }
    try {
      return NextResponse.json(JSON.parse(text), {
        headers: { "Cache-Control": "no-store, no-cache" },
      });
    } catch {
      return new NextResponse(text, {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
  } catch (err) {
    return NextResponse.json(
      { error: "mission control unreachable", detail: String(err) },
      { status: 502 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const rel = path.join("/");

  if (isBlocked(rel)) {
    return NextResponse.json(
      { error: `proxy for /api/mc/${rel} is blocked` },
      { status: 403 }
    );
  }

  const qs = req.nextUrl.searchParams.toString();
  const url = `${MC_BASE}/api/${rel}${qs ? `?${qs}` : ""}`;

  try {
    const upstream = await fetch(url, {
      headers: { "x-mc-token": MC_TOKEN },
      cache: "no-store",
    });
    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Mission Control upstream returned ${upstream.status}` },
        { status: upstream.status }
      );
    }
    const data = await upstream.json();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store, no-cache" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "mission control unreachable", detail: String(err) },
      { status: 502 }
    );
  }
}
