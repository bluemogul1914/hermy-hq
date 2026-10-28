import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Groups MC /api/board columns for the Dashboard kanban view.
// MC returns { unassigned, assigned, in_progress, done, pending_approval,
// blocked, error } — we forward it with a consistent column ordering.
const MC_BASE = (process.env.MC_URL || "http://172.18.0.1:3200").replace(/\/$/, "");
const MC_TOKEN = process.env.MC_AUTH_TOKEN || "";

const COLUMNS = ["in_progress", "pending_approval", "blocked", "unassigned", "assigned", "done"];

export async function GET() {
  try {
    const res = await fetch(`${MC_BASE}/api/board`, {
      headers: MC_TOKEN ? { "x-mc-token": MC_TOKEN } : {},
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json({}, { headers: { "Cache-Control": "no-store" } });
    }
    const data: Record<string, any[]> = await res.json();
    // Normalize: ensure all expected columns exist
    const board: Record<string, any[]> = {};
    COLUMNS.forEach((col) => { board[col] = data[col] || []; });
    // Include any extra columns (e.g., "error")
    Object.keys(data).forEach((k) => {
      if (!(k in board) && Array.isArray(data[k])) board[k] = data[k];
    });
    return NextResponse.json(board, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("Board API error:", String(err));
    return NextResponse.json({ error: "Mission Control unreachable" }, { status: 502 });
  }
}
