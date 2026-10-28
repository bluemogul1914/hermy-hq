import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Proxy to MC's built-in /api/dashboard endpoint, which already composes
// stats, charts, recent activity, and recent tasks in the format the
// Dashboard page expects. The MC x-mc-token is attached server-side.
const MC_BASE = (process.env.MC_URL || "http://172.18.0.1:3200").replace(/\/$/, "");
const MC_TOKEN = process.env.MC_AUTH_TOKEN || "";

export async function GET() {
  try {
    const res = await fetch(`${MC_BASE}/api/dashboard`, {
      headers: MC_TOKEN ? { "x-mc-token": MC_TOKEN } : {},
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json({ error: `Mission Control upstream returned ${res.status}` }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store, no-cache" },
    });
  } catch (err) {
    console.error("Dashboard API error:", String(err));
    return NextResponse.json({ error: "Mission Control unreachable" }, { status: 502 });
  }
}
