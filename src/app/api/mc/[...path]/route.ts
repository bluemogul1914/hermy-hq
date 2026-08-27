import { NextRequest, NextResponse } from "next/server";

// ─────────────────────────────────────────────────────────────────────────────
// Blue Mogul AI · Mission Control proxy
// Single source of truth: every read-backed widget in the cockpit calls
// mission-control's REST API through this route. The MC shared token lives
// ONLY server-side (env MC_URL + MC_AUTH_TOKEN) and is never sent to the
// browser. Intentional no-cache so the cockpit shows live board state.
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MC_BASE = process.env.MC_URL || "https://mission-control.bluemogul.us";
const MC_TOKEN = process.env.MC_AUTH_TOKEN || "";

// Whitelist of read-only Mission Control paths the cockpit is allowed to proxy.
// Everything else is rejected so this route can never be used as a write pipe.
const READ_ONLY = new Set([
  "dashboard",
  "board",
  "status",
  "goals",
  "goals/current-focus",
  "budgets",
  "tasks/unassigned",
  "tasks/mine/dev",
  "tasks/pending-approval",
  "tasks/stale",
]);

// Whitelist of Mission Control write actions the cockpit may invoke.
// Only the exact patterns below are forwarded as POST — the MC token never
// reaches the browser. Approve = Tracey/approver action; Start = kickoff.
function isAllowedAction(rel: string): boolean {
  // tasks/<id>/start , tasks/<id>/approve , tasks/<id>/reject
  const m = rel.match(/^tasks\/(\d+)\/(start|approve|reject)$/);
  if (!m) return false;
  const action = m[2];
  // reject is a write that needs a reason+approver; allow it too (approval gate)
  return action === "start" || action === "approve" || action === "reject";
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const rel = path.join("/");
  if (!isAllowedAction(rel)) {
    return NextResponse.json(
      { error: `write proxy for /api/mc/${rel} is not allowed` },
      { status: 403 }
    );
  }
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    /* empty body ok */
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
  if (!READ_ONLY.has(rel)) {
    return NextResponse.json(
      { error: `proxy for /api/mc/${rel} is not allowed` },
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