import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MC_BASE = process.env.MC_URL || "http://172.18.0.1:3200";
const MC_TOKEN = process.env.MC_AUTH_TOKEN || "";
const TERM_PASS = process.env.TERMINAL_PASSWORD || "changeme";

async function checkStatus() {
  try {
    const res = await fetch(`${MC_BASE}/api/status`, {
      headers: { "x-mc-token": MC_TOKEN },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const agents = await res.json();
      const agentCount = Array.isArray(agents) ? agents.length : 0;
      return { mcReachable: true, agentCount, terminalAvailable: true, sessions: [], terminalPassword: TERM_PASS ? "configured" : "not set" };
    }
    return { mcReachable: false, agentCount: 0, terminalAvailable: false, sessions: [], error: `MC upstream returned ${res.status}` };
  } catch (e: any) {
    return { mcReachable: false, agentCount: 0, terminalAvailable: false, sessions: [], error: String(e).slice(0, 120) };
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const pathParts = url.pathname.split("/").slice(3);
  const subPath = pathParts[0] || "";
  const status = await checkStatus();
  return NextResponse.json(status);
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const pathParts = url.pathname.split("/").slice(3);
  const subPath = pathParts[0] || "";
  const body = await request.json().catch(() => ({}));

  if (subPath === "run" || subPath === "") {
    const { command, password, timeout = 30 } = body;
    if (password !== TERM_PASS) {
      return NextResponse.json({ error: "Invalid terminal password" }, { status: 403 });
    }
    if (!command) {
      return NextResponse.json({ error: "Command required" }, { status: 400 });
    }
    try {
      const { stdout, stderr } = await execAsync(command, { timeout: timeout * 1000, maxBuffer: 1024 * 1024 });
      return NextResponse.json({ stdout, stderr, exitCode: 0 });
    } catch (e: any) {
      return NextResponse.json({ stdout: e.stdout || "", stderr: e.stderr || e.message || "Command failed", exitCode: e.code || 1 });
    }
  }
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
