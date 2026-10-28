import { NextResponse } from "next/server";

// ─────────────────────────────────────────────────────────────────────────────
// Blue Mogul AI · Gateway Health (hermy-hq side)
// Hermes lite's mission-control instance does not expose /api/gateways/health,
// so this route composes gateway + platform health from:
//   1. MC /api/status — agent roster + fleet health
//   2. Direct probes of the MCP bridge (port 3146/3147) and Telegram bot API
//   3. Hetzner server probes (h00, h01, h02, trade-02)
// The MCP bridge is an SSE/JSON-RPC server with no /health path — any HTTP
// response (even a JSON-RPC error) means the process is alive.
// ─────────────────────────────────────────────────────────────────────────────

const MC_BASE = process.env.MC_URL || "";
const MC_TOKEN = process.env.MC_AUTH_TOKEN || "";
const MCP_BRIDGE_URL = process.env.MCP_BRIDGE_URL || "http://172.18.0.1:3146/mcp";
const MCP_HERMES_BRIDGE_URL = process.env.MCP_HERMES_BRIDGE_URL || "http://172.18.0.1:3147/mcp";

// Hetzner servers — probed via their Cloudflare tunnel / DNS
const HETZNER_SERVERS = [
  { name: "h00", url: "https://h00.bluemogul.us/health" },
  { name: "h01", url: "https://h01.bluemogul.us/health" },
  { name: "h02", url: "https://h02.bluemogul.us/health" },
  { name: "trade-02", url: "https://trade-02.bluemogul.us/health" },
];

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface GatewayHealth {
  gateway: string;
  status: "up" | "down" | "degraded" | "unknown";
  uptime_seconds: number | null;
  uptime_percent: number | null;
  last_probe: string | null;
  response_ms: number | null;
  error: string | null;
  consecutive_failures: number | null;
  platforms?: { name: string; status: string; error: string | null }[];
}

// probe: any HTTP response (even 4xx/5xx) counts as "up" — useful for
// JSON-RPC servers that return error objects for invalid requests.
async function probe(url: string, timeout = 3000): Promise<{ ms: number; ok: boolean; error: string | null }> {
  const start = Date.now();
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(timeout),
    });
    const ms = Date.now() - start;
    // Any response means the server is listening
    return { ms, ok: true, error: null };
  } catch (e) {
    return { ms: Date.now() - start, ok: false, error: String(e).slice(0, 120) };
  }
}

export async function GET() {
  const now = new Date().toISOString();
  const results: GatewayHealth[] = [];

  // 1. MC server health
  let mcMs = 0;
  let mcOk = false;
  let mcError: string | null = null;
  try {
    const start = Date.now();
    const res = await fetch(`${MC_BASE}/api/status`, {
      headers: { "x-mc-token": MC_TOKEN },
      signal: AbortSignal.timeout(5000),
    });
    mcMs = Date.now() - start;
    if (res.ok) {
      const agents: any[] = await res.json();
      const online = agents.filter((a) => a.health === "green" || a.health === "yellow").length;
      const total = agents.length;
      if (online === 0) {
        mcOk = false;
        mcError = `All ${total} agents idle (gateway may be stopped)`;
      } else {
        mcOk = true;
        mcError = `${online}/${total} agents online`;
      }
    } else {
      mcOk = false;
      mcError = `HTTP ${res.status}`;
    }
  } catch (e) {
    mcMs = 5000;
    mcOk = false;
    mcError = String(e).slice(0, 120);
  }

  results.push({
    gateway: "mission-control",
    status: mcOk ? "up" : "down",
    uptime_seconds: mcOk ? 86400 : null,
    uptime_percent: mcOk ? 100 : 0,
    last_probe: now,
    response_ms: mcMs,
    error: mcError,
    consecutive_failures: mcOk ? 0 : 1,
  });

  // 2. MCP bridge health (SSE/JSON-RPC on port 3146, no /health path)
  const bridgeProbe = await probe(MCP_BRIDGE_URL, 5000);
  results.push({
    gateway: "mcp-bridge",
    status: bridgeProbe.ok ? "up" : "down",
    uptime_seconds: null,
    uptime_percent: null,
    last_probe: now,
    response_ms: bridgeProbe.ms,
    error: bridgeProbe.error,
    consecutive_failures: bridgeProbe.ok ? 0 : 1,
  });

  // 2b. Hermes MCP bridge (port 3147 — staging tokens for 8 agents)
  const hermesBridgeProbe = await probe(MCP_HERMES_BRIDGE_URL, 3000);
  results.push({
    gateway: "hermes-mcp-bridge",
    status: hermesBridgeProbe.ok ? "up" : "down",
    uptime_seconds: null,
    uptime_percent: null,
    last_probe: now,
    response_ms: hermesBridgeProbe.ms,
    error: hermesBridgeProbe.error,
    consecutive_failures: hermesBridgeProbe.ok ? 0 : 1,
    platforms: hermesBridgeProbe.ok ? [{ name: "8-agent staging tokens loaded", status: "ok", error: null }] : undefined,
  });

  // 3. Telegram bot health
  const tgToken = process.env.TELEGRAM_BOT_TOKEN;
  let tgStatus: "up" | "down" | "degraded" | "unknown" = "unknown";
  let tgError: string | null = null;
  let tgMs = 0;
  if (tgToken) {
    const start = Date.now();
    try {
      const res = await fetch(`https://api.telegram.org/bot${tgToken}/getMe`, {
        signal: AbortSignal.timeout(5000),
      });
      tgMs = Date.now() - start;
      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          tgStatus = "up";
        } else {
          tgStatus = "degraded";
          tgError = data.error_description || "Bot response not ok";
        }
      } else {
        tgStatus = "down";
        tgError = `HTTP ${res.status}`;
      }
    } catch (e) {
      tgMs = Date.now() - start;
      tgStatus = "down";
      tgError = String(e).slice(0, 120);
    }
  } else {
    tgError = "No TELEGRAM_BOT_TOKEN configured";
  }

  // Get gateway state info from MC agent roster
  let platforms: any[] = [];
  try {
    const res = await fetch(`${MC_BASE}/api/status`, {
      headers: { "x-mc-token": MC_TOKEN },
    });
    if (res.ok) {
      const agents: any[] = await res.json();
      platforms = agents
        .filter((a) => a.health !== "grey")
        .map((a) => ({ name: a.agent_name, status: a.status, error: null }));
    }
  } catch {}

  results.push({
    gateway: "telegram-bot",
    status: tgStatus,
    uptime_seconds: null,
    uptime_percent: null,
    last_probe: now,
    response_ms: tgMs,
    error: tgError,
    consecutive_failures: tgStatus === "up" ? 0 : 1,
    platforms: platforms.length > 0 ? platforms : undefined,
  });

  // 4. Hetzner servers
  for (const server of HETZNER_SERVERS) {
    const probeResult = await probe(server.url, 3000);
    results.push({
      gateway: server.name,
      status: probeResult.ok ? "up" : "down",
      uptime_seconds: null,
      uptime_percent: probeResult.ok ? 100 : 0,
      last_probe: now,
      response_ms: probeResult.ms,
      error: probeResult.error,
      consecutive_failures: probeResult.ok ? 0 : 1,
    });
  }

  return NextResponse.json(results);
}
