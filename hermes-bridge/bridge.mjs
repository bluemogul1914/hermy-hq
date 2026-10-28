#!/usr/bin/env node
/**
 * Hermy HQ ↔ Hermes bridge.
 *
 * Runs on the Mac mini where Hermes lives. Talks to the shared Postgres
 * (the same DATABASE_URL the website uses) — nothing is exposed to the
 * internet. Two jobs:
 *
 *   PULL  (Hermes → website): mirror the kanban board into HermesTask,
 *         cron list + health into DataStore, and emit activity events.
 *   PUSH  (website → Hermes): pick up AgentRequest rows that are `queued`
 *         (safe) or `approved` (human-approved side-effecting), run them
 *         through the `hermes` CLI, and write results back.
 *
 * Requires: the `hermes` binary on PATH, and env DATABASE_URL.
 * Optional env: HERMES_BOARD (default "default"), BRIDGE_POLL_MS (5000),
 *               BRIDGE_MIRROR_MS (30000), HERMES_BIN (default "hermes").
 *
 * MISSION CONTROL (source of truth): when MC_URL + MC_AUTH_TOKEN are set,
 * mirrorMissionControl() additionally mirrors the live MC task board and goal
 * tree. MC is where Blue Mogul work is actually written (goals, MRR milestones,
 * evidence, approvals); the Hermes kanban is unused, so mirroring only the
 * kanban leaves this cockpit empty. Set MC_MIRROR=0 to disable.
 */
import pg from "pg";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const execFileP = promisify(execFile);
const HERMES = process.env.HERMES_BIN || "hermes";
const BOARD = process.env.HERMES_BOARD || "default";
const POLL_MS = Number(process.env.BRIDGE_POLL_MS || 5000);
const MIRROR_MS = Number(process.env.BRIDGE_MIRROR_MS || 30000);
const RUN_TIMEOUT_MS = Number(process.env.BRIDGE_RUN_TIMEOUT_MS || 240000);
const WIKI_DIR = process.env.HERMES_WIKI || path.join(os.homedir(), ".hermes", "wiki");
const BRIEF_HOUR = Number(process.env.BRIEF_HOUR || 8);   // local hour to auto-generate the daily brief

// ── Mission Control (the real work board) ────────────────────────────────
// MC_URL/MC_AUTH_TOKEN come from the agent dotenv; MC_MIRROR=0 disables.
const MC_URL = String(process.env.MC_URL || "").replace(/\/+$/, "");
const MC_TOKEN = process.env.MC_AUTH_TOKEN || "";
const MC_MIRROR = process.env.MC_MIRROR !== "0" && !!MC_URL && !!MC_TOKEN;
const MC_BOARD = process.env.MC_BOARD || "bm-mc";
// MC statuses → the vocabulary the cockpit widget already renders.
const MC_STATUS = { assigned: "ready", in_progress: "running", pending_approval: "review", blocked: "blocked", done: "done" };
const MC_PRIORITY = { high: 3, medium: 2, low: 1 };
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const BRIEF_PROMPT =
  "You are the operator's chief of staff for Blue Mogul Enterprise. Produce today's brief. " +
  "READ THE REAL WORK BOARD FIRST by running these in your terminal: " +
  "`/opt/mission-control/mc-cli.sh board` (all tasks by lane) and `/opt/mission-control/mc-cli.sh goals` " +
  "(the North Star / MRR goal tree). Mission Control is the source of truth for Blue Mogul work — " +
  "there is no meaningful Hermes kanban. Also read your memory wiki open-loops (~/.hermes/wiki). " +
  "Output ONLY valid JSON (no prose, no code fences) " +
  'in exactly this shape: {"greeting":"one warm line","summary":"2-3 sentences on where things stand",' +
  '"sections":[{"label":"Needs your decision","items":["..."]},{"label":"Top priorities","items":["..."]},' +
  '{"label":"Recently shipped","items":["..."]},{"label":"Next actions","items":["..."]}]}. ' +
  "Every item must be short, concrete, and specific — name the task id or the agent. " +
  "Lead with anything blocked or overdue against an MRR milestone. Omit a section if it has nothing.";
let lastBriefDate = null;

const DB_URL = process.env.DATABASE_URL || "";
if (!DB_URL) { console.error("DATABASE_URL is required (use the direct postgres:// URL, not a prisma:// Accelerate URL)"); process.exit(1); }
if (DB_URL.startsWith("prisma://") || DB_URL.startsWith("prisma+")) {
  console.error("DATABASE_URL is a Prisma Accelerate URL; the bridge needs a DIRECT postgres:// connection string (e.g. POSTGRES_URL).");
  process.exit(1);
}
// Cloud Postgres (Prisma Postgres/Neon/Supabase/RDS) needs SSL; localhost doesn't.
const isLocal = /@(localhost|127\.0\.0\.1)/.test(DB_URL);
const pool = new pg.Pool({ connectionString: DB_URL, max: 4, ssl: isLocal ? undefined : { rejectUnauthorized: false } });

const log = (...a) => console.log(new Date().toISOString(), ...a);
const q = (text, params) => pool.query(text, params);

async function hermes(args, { timeout = 30000 } = {}) {
  const { stdout } = await execFileP(HERMES, args, { timeout, maxBuffer: 8 * 1024 * 1024 });
  return stdout;
}

async function emit(kind, title, { detail = null, agent = "hermes", level = "info", meta = null } = {}) {
  await q(
    `INSERT INTO "AgentEvent" (id, kind, title, detail, agent, level, meta, "createdAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7, now())`,
    [randomUUID(), kind, title.slice(0, 200), detail, agent, level, meta ? JSON.stringify(meta) : null]
  );
}

async function setStore(key, data) {
  await q(
    `INSERT INTO "DataStore" (key, data, "updatedAt") VALUES ($1,$2, now())
     ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, "updatedAt" = now()`,
    [key, JSON.stringify(data)]
  );
}

/* ─────────────── PULL: mirror Hermes → Postgres ─────────────── */
async function mirrorKanban() {
  let tasks = [];
  try {
    // NB: this Hermes CLI wants --board BEFORE the subcommand.
    const out = await hermes(["kanban", "--board", BOARD, "list", "--json"], { timeout: 15000 });
    const parsed = JSON.parse(out || "[]");
    tasks = Array.isArray(parsed) ? parsed : parsed.tasks || [];
  } catch (e) { log("kanban list failed:", e.message.split("\n")[0]); return; }

  const seen = new Set();
  for (const t of tasks) {
    const id = String(t.id ?? t.task_id ?? "");
    if (!id) continue;
    seen.add(id);
    await q(
      `INSERT INTO "HermesTask" (id, board, title, assignee, status, priority, result, "updatedAt", "syncedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7, now(), now())
       ON CONFLICT (id) DO UPDATE SET
         title=EXCLUDED.title, assignee=EXCLUDED.assignee, status=EXCLUDED.status,
         priority=EXCLUDED.priority, result=EXCLUDED.result, "syncedAt"=now()`,
      [id, BOARD, String(t.title ?? "untitled").slice(0, 300), t.assignee ?? null,
       String(t.status ?? "todo"), t.priority != null ? Number(t.priority) : null,
       t.result ? String(t.result).slice(0, 2000) : null]
    );
  }
  // prune tasks that vanished from the board
  if (seen.size) {
    await q(`DELETE FROM "HermesTask" WHERE board=$1 AND id <> ALL($2::text[])`, [BOARD, [...seen]]);
  } else {
    await q(`DELETE FROM "HermesTask" WHERE board=$1`, [BOARD]);
  }
}

/* ─────────── PULL: Mission Control (source of truth) → Postgres ───────────
 * The Hermes kanban is unused; real Blue Mogul work lives in Mission Control.
 * Without this, the cockpit's board has nothing to render.
 */
async function mcGet(pathname) {
  const res = await fetch(`${MC_URL}${pathname}`, {
    headers: { "Authorization": `Bearer ${MC_TOKEN}`, "user-agent": UA, accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${pathname} -> HTTP ${res.status}`);
  return res.json();
}

async function mirrorMissionControl() {
  if (!MC_MIRROR) return;

  // MC's task endpoint returns { ok, tasks: [...], count }.
  let mcTasks;
  try { mcTasks = await mcGet("/api/tasks"); }
  catch (e) { log("MC tasks failed:", e.message); return; }

  const tasks = Array.isArray(mcTasks?.tasks) ? mcTasks.tasks : [];
  const seen = new Set();
  for (const t of tasks) {
    const id = `mc-${t.id}`;                    // namespaced so the kanban prune can't collide
    seen.add(id);
    const lane = String(t.status || "assigned");
    await q(
      `INSERT INTO "HermesTask" (id, board, title, assignee, status, priority, result, "updatedAt", "syncedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7, now(), now())
       ON CONFLICT (id) DO UPDATE SET
         title=EXCLUDED.title, assignee=EXCLUDED.assignee, status=EXCLUDED.status,
         priority=EXCLUDED.priority, result=EXCLUDED.result, "syncedAt"=now()`,
      [
        id,
        MC_BOARD,
        String(t.title ?? "untitled").slice(0, 300),
        t.assignee ?? null,
        MC_STATUS[lane] || lane,
        MC_PRIORITY[String(t.priority || "medium")] ?? 2,
        (t.evidence || t.block_reason || (t.goal_id ? `goal:${t.goal_id}` : null))?.slice?.(0, 2000) ?? null,
      ]
    );
  }
  if (seen.size) await q(`DELETE FROM "HermesTask" WHERE board=$1 AND id <> ALL($2::text[])`, [MC_BOARD, [...seen]]);
  else await q(`DELETE FROM "HermesTask" WHERE board=$1`, [MC_BOARD]);

  // Goal tree (MRR milestones + service lines) → DataStore for the cockpit UI.
  try {
    const goals = await mcGet("/api/goals");
    await setStore("mc-goals", { goals, syncedAt: new Date().toISOString() });
  } catch (e) { log("MC goals failed:", e.message); }

  return tasks.length;
}

async function mirrorCrons() {
  try {
    const out = await hermes(["cron", "list", "--all"], { timeout: 15000 });
    const lines = out.split("\n").map((l) => l.trimEnd()).filter(Boolean);
    await setStore("hermes-crons", { jobs: lines, raw: out.slice(0, 8000), syncedAt: new Date().toISOString() });
  } catch (e) { log("cron list failed:", e.message.split("\n")[0]); }
}

function parseInsights(out) {
  const num = (re) => {
    const m = out.match(re);
    return m ? Number(String(m[1]).replace(/,/g, "")) : null;
  };
  const models = [];
  const inModels = /Model\s+Sessions\s+Tokens/i.test(out);
  if (inModels) {
    const after = out.slice(out.search(/Model\s+Sessions\s+Tokens/i));
    for (const line of after.split("\n").slice(1)) {
      const m = line.match(/^\s{2}(\S+)\s+(\d+)\s+([\d,]+)\s*$/);
      if (!m) { if (line.trim() === "") continue; else if (models.length) break; else continue; }
      models.push({ model: m[1], sessions: Number(m[2]), tokens: Number(m[3].replace(/,/g, "")) });
    }
  }
  const periodM = out.match(/Period:\s*([^\n]+)/);
  return {
    period: periodM ? periodM[1].trim() : null,
    sessions: num(/Sessions:\s+([\d,]+)/),
    messages: num(/Messages:\s+([\d,]+)/),
    toolCalls: num(/Tool calls:\s+([\d,]+)/),
    inputTokens: num(/Input tokens:\s+([\d,]+)/),
    outputTokens: num(/Output tokens:\s+([\d,]+)/),
    totalTokens: num(/Total tokens:\s+([\d,]+)/),
    estimatedUsd: num(/Estimated:\s*~?\$([\d,.]+)/),
    models: models.slice(0, 12),
  };
}

async function mirrorCost() {
  for (const args of [["insights", "--days", "7"], ["insights"]]) {
    try {
      const out = await hermes(args, { timeout: 15000 });
      const days = args.includes("--days") ? Number(args[args.indexOf("--days") + 1]) : 30;
      await setStore("hermes-cost", {
        days,
        parsed: parseInsights(out),
        summary: out.slice(0, 4000),
        syncedAt: new Date().toISOString(),
      });
      return;
    } catch { /* try next arg shape */ }
  }
}

/* ─────────── PULL: Gateway health probe loop ───────────
 * The MC server exposes gateway health endpoints but has no background
 * ticker. The bridge fills that gap by periodically fetching the live
 * GatewayHealth record from MC and mirroring it into the local
 * GatewayHealthLog table (used by the hermy-hq Gateways tab).
 */
async function probeGateways() {
  if (!MC_URL || !MC_TOKEN) return;
  let health;
  try { health = await mcGet("/api/gateways/health"); }
  catch (e) { log("MC gateway health failed:", e.message.split("\n")[0]); return; }

  const gateways = health?.gateways || [];
  for (const g of gateways) {
    // Mirror each gateway's latest probe into local Postgres
    await q(
      `INSERT INTO "GatewayHealthLog" (id, "gatewayName", "gatewayUrl", status, "latencyMs", "statusCode", detail, "probedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, to_timestamp($8))
       ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status, "latencyMs"=EXCLUDED."latencyMs",
         "statusCode"=EXCLUDED."statusCode", detail=EXCLUDED.detail, "probedAt"=EXCLUDED."probedAt"`,
      [
        g.gateway_id || randomUUID(),
        g.gateway_id || "unknown",
        g.url || null,
        g.status || "unknown",
        g.latency_ms || null,
        g.status_code || null,
        g.error || null,
        g.probed_at || Math.floor(Date.now() / 1000),
      ]
    );
  }
  if (gateways.length) {
    await setStore("gateway-health", {
      gateways,
      syncedAt: new Date().toISOString(),
      count: gateways.length,
    });
  }
}

async function mirrorHealth() {
  let online = false, gateway = "unknown", detail = "";
  try {
    const out = await hermes(["status"], { timeout: 12000 });
    detail = out.slice(0, 4000);
    online = /online|running|connected/i.test(out);
    gateway = /gateway[^\n]*(running|online)/i.test(out) ? "running" : "stopped";
  } catch (e) { detail = e.message.split("\n")[0]; }
  await setStore("hermes-health", { online, gateway, detail, lastSeen: new Date().toISOString() });
}

/* ─────────────── Memory Wiki (warm tier: git-tracked markdown) ─────────────── */
function parseEntry(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const fm = {}; let body = md;
  if (m) {
    body = m[2];
    for (const line of m[1].split("\n")) {
      const kv = line.match(/^([A-Za-z_]+):\s*(.*)$/);
      if (!kv) continue;
      const v = kv[2].trim();
      if (v.startsWith("[") && v.endsWith("]")) fm[kv[1]] = v.slice(1, -1).split(",").map((s) => s.trim()).filter(Boolean);
      else fm[kv[1]] = v === "null" || v === "" ? null : v;
    }
  }
  return { fm, body: body.trim() };
}
function walkMd(dir, out = []) {
  let items = [];
  try { items = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const it of items) {
    const full = path.join(dir, it.name);
    if (it.isDirectory()) { if (it.name !== ".git") walkMd(full, out); }
    else if (it.name.endsWith(".md") && it.name !== "INDEX.md") out.push(full);
  }
  return out;
}
async function mirrorWiki() {
  if (!fs.existsSync(WIKI_DIR)) return;
  const seen = new Set();
  for (const file of walkMd(WIKI_DIR)) {
    const rel = path.relative(WIKI_DIR, file);
    const id = rel.replace(/\.md$/, "");
    seen.add(id);
    let raw = ""; try { raw = fs.readFileSync(file, "utf8"); } catch { continue; }
    const { fm, body } = parseEntry(raw);
    await q(
      `INSERT INTO "HermesMemory" (id, path, type, title, status, confidence, provenance, tags, links, body, "validFrom", "validTo", "updatedAt", "syncedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, now(), now())
       ON CONFLICT (id) DO UPDATE SET path=EXCLUDED.path, type=EXCLUDED.type, title=EXCLUDED.title,
         status=EXCLUDED.status, confidence=EXCLUDED.confidence, provenance=EXCLUDED.provenance,
         tags=EXCLUDED.tags, links=EXCLUDED.links, body=EXCLUDED.body,
         "validFrom"=EXCLUDED."validFrom", "validTo"=EXCLUDED."validTo", "syncedAt"=now()`,
      [id, rel, fm.type || "fact", fm.title || id, fm.status || "active", fm.confidence || null,
       fm.provenance || null, Array.isArray(fm.tags) ? fm.tags : [], Array.isArray(fm.links) ? fm.links : [],
       body, fm.valid_from || null, fm.valid_to || null]
    );
  }
  if (seen.size) await q(`DELETE FROM "HermesMemory" WHERE id <> ALL($1::text[])`, [[...seen]]);
  else await q(`DELETE FROM "HermesMemory"`);
}
function writeWikiEntry(e) {
  const rel = e.path || `${e.type || "note"}s/${e.id}.md`;
  const full = path.join(WIKI_DIR, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  const now = new Date().toISOString().slice(0, 10);
  const lines = [
    "---", `id: ${e.id}`, `type: ${e.type || "note"}`, `title: ${e.title}`,
    `status: ${e.status || "active"}`,
    e.confidence ? `confidence: ${e.confidence}` : null,
    `provenance: ${e.provenance || "dashboard"}`,
    `tags: [${(e.tags || []).join(", ")}]`, `links: [${(e.links || []).join(", ")}]`,
    `updated: ${now}`, "---", "", e.body || "", "",
  ].filter((l) => l !== null);
  fs.writeFileSync(full, lines.join("\n"), "utf8");
  return rel;
}
async function gitCommitWiki(msg) {
  try {
    if (!fs.existsSync(path.join(WIKI_DIR, ".git"))) await execFileP("git", ["-C", WIKI_DIR, "init"]).catch(() => {});
    await execFileP("git", ["-C", WIKI_DIR, "add", "-A"]).catch(() => {});
    await execFileP("git", ["-C", WIKI_DIR, "commit", "-m", msg]).catch(() => {});
  } catch { /* ignore */ }
}

/* ─────────────── Skills mirror + write ─────────────── */
const SKILLS_DIR = process.env.HERMES_SKILLS || path.join(os.homedir(), ".hermes", "skills");

function parseSkillFrontmatter(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---/);
  const fm = {};
  if (m) {
    for (const line of m[1].split("\n")) {
      const kv = line.match(/^([A-Za-z_-]+):\s*(.*)$/);
      if (!kv) continue;
      let v = kv[2].trim().replace(/^["']|["']$/g, "");
      fm[kv[1]] = v;
    }
  }
  const bodyStart = m ? m[0].length : 0;
  const body = md.slice(bodyStart).trim();
  return { fm, body };
}

function walkSkillDirs(dir, depth, acc) {
  if (depth > 3) return acc;
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    const full = path.join(dir, e.name);
    if (!e.isDirectory()) continue;
    const skillMd = path.join(full, "SKILL.md");
    if (fs.existsSync(skillMd)) {
      let raw = ""; try { raw = fs.readFileSync(skillMd, "utf8"); } catch { /* skip */ }
      const { fm } = parseSkillFrontmatter(raw);
      const parts = path.relative(SKILLS_DIR, full).split(path.sep);
      acc.push({
        name: fm.name || e.name,
        slug: e.name,
        category: parts.length > 1 ? parts[0] : null,
        path: path.relative(SKILLS_DIR, full),
        description: fm.description || "",
        version: fm.version || null,
        bytes: raw.length,
      });
    }
    walkSkillDirs(full, depth + 1, acc);
  }
  return acc;
}

async function mirrorSkills() {
  try {
    if (!fs.existsSync(SKILLS_DIR)) { await setStore("hermes-skills", { skills: [], syncedAt: new Date().toISOString() }); return; }
    const skills = walkSkillDirs(SKILLS_DIR, 0, []);
    skills.sort((a, b) => a.slug.localeCompare(b.slug));
    await setStore("hermes-skills", { skills, base: SKILLS_DIR, syncedAt: new Date().toISOString() });
  } catch (e) { log("mirrorSkills err", e.message.split("\n")[0]); }
}

function writeSkill(e) {
  const slug = String(e.slug || e.name || "").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
  if (!slug) throw new Error("skill slug required");
  const category = e.category ? String(e.category).replace(/[^a-zA-Z0-9_-]/g, "") : "";
  const rel = category ? path.join(category, slug) : slug;
  const dir = path.join(SKILLS_DIR, rel);
  fs.mkdirSync(dir, { recursive: true });
  const desc = String(e.description || "").replace(/\n/g, " ");
  const lines = [
    "---",
    `name: ${slug}`,
    `description: ${desc}`,
    `version: ${e.version || "1.0.0"}`,
    "---",
    "",
    String(e.body || "").trim(),
    "",
  ];
  fs.writeFileSync(path.join(dir, "SKILL.md"), lines.join("\n"), "utf8");
  return rel;
}

function deleteSkill(e) {
  const rel = String(e.path || e.slug || "").replace(/\.\./g, "").replace(/^\/+/, "");
  if (!rel) throw new Error("skill path required");
  const dir = path.join(SKILLS_DIR, rel);
  if (!dir.startsWith(SKILLS_DIR)) throw new Error("refusing to delete outside skills dir");
  fs.rmSync(dir, { recursive: true, force: true });
  return rel;
}

/* ─────────────── Chief-of-staff daily brief ─────────────── */
async function generateBriefing() {
  const raw = (await hermes(["-z", BRIEF_PROMPT], { timeout: RUN_TIMEOUT_MS })).trim();
  let brief;
  try {
    const jsonStr = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const m = jsonStr.match(/\{[\s\S]*\}/);
    brief = JSON.parse(m ? m[0] : jsonStr);
  } catch { brief = { summary: raw.slice(0, 1500), sections: [] }; }
  brief.generatedAt = new Date().toISOString();
  // Normalise section shape — the model sometimes emits the empty template stub,
  // or nests items under different keys. Drop any section with no label or no items.
  if (Array.isArray(brief.sections)) {
    brief.sections = brief.sections
      .map((s) => ({
        label: String(s?.label ?? s?.title ?? s?.heading ?? "").trim(),
        items: (Array.isArray(s?.items) ? s.items : Array.isArray(s?.content) ? s.content : [])
          .map((i) => String(typeof i === "string" ? i : i?.text ?? i?.title ?? "").trim())
          .filter(Boolean),
      }))
      .filter((s) => s.label && s.items.length);
  } else {
    brief.sections = [];
  }
  await setStore("hermes-briefing", brief);
  await emit("status", "Daily brief generated", { level: "up" });
}
async function maybeDailyBrief() {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  if (now.getHours() >= BRIEF_HOUR && lastBriefDate !== today) {
    lastBriefDate = today;
    try { await generateBriefing(); } catch (e) { log("daily brief err", e.message); }
  }
}

/* ─────────────── PUSH: run website requests via Hermes ─────────────── */
async function runRequest(r) {
  await q(`UPDATE "AgentRequest" SET status='running', "startedAt"=now(), "updatedAt"=now() WHERE id=$1`, [r.id]);
  await emit("run", `Started: ${r.title}`, { level: "info", meta: { requestId: r.id, kind: r.kind } });
  try {
    let result = "";
    if (r.kind === "oneshot" || r.kind === "chat") {
      result = (await hermes(["-z", r.prompt || r.title], { timeout: RUN_TIMEOUT_MS })).trim();
    } else if (r.kind === "kanban") {
      result = (await hermes(["kanban", "--board", BOARD, "create", "--json", r.title], { timeout: 20000 })).trim();
    } else if (r.kind.startsWith("cron.")) {
      const op = r.kind.split(".")[1];
      const a = JSON.parse(r.prompt || "{}");
      const argv =
        op === "create" ? ["cron", "create", a.schedule, a.prompt || a.name].filter(Boolean)
        : op === "run"    ? ["cron", "run", a.id || a.name]
        : op === "pause"  ? ["cron", "pause", a.id || a.name]
        : op === "resume" ? ["cron", "resume", a.id || a.name]
        : op === "remove" ? ["cron", "remove", a.id || a.name]
        : op === "edit"   ? ["cron", "edit", a.id || a.name]
        : null;
      if (!argv) throw new Error(`unknown cron op ${op}`);
      result = (await hermes(argv, { timeout: 20000 })).trim();
      await mirrorCrons();
    } else if (r.kind === "memory.write") {
      const e = JSON.parse(r.prompt || "{}");
      const rel = writeWikiEntry(e);
      await gitCommitWiki(`wiki: update ${rel} (via dashboard)`);
      await mirrorWiki();
      result = `wrote ${rel}`;
    } else if (r.kind === "skill.write") {
      const e = JSON.parse(r.prompt || "{}");
      const rel = writeSkill(e);
      await mirrorSkills();
      result = `wrote skill ${rel}`;
    } else if (r.kind === "skill.delete") {
      const e = JSON.parse(r.prompt || "{}");
      const rel = deleteSkill(e);
      await mirrorSkills();
      result = `deleted skill ${rel}`;
    } else if (r.kind === "briefing.generate") {
      await generateBriefing();
      lastBriefDate = new Date().toISOString().slice(0, 10);
      result = "brief updated";
    } else {
      throw new Error(`unknown kind ${r.kind}`);
    }
    await q(`UPDATE "AgentRequest" SET status='done', result=$2, "finishedAt"=now(), "updatedAt"=now() WHERE id=$1`,
      [r.id, result.slice(0, 8000)]);
    await emit("run", `Done: ${r.title}`, { level: "up", detail: result.slice(0, 400), meta: { requestId: r.id } });
  } catch (e) {
    const msg = (e.stderr || e.message || "error").toString().split("\n")[0].slice(0, 600);
    await q(`UPDATE "AgentRequest" SET status='failed', error=$2, "finishedAt"=now(), "updatedAt"=now() WHERE id=$1`, [r.id, msg]);
    await emit("run", `Failed: ${r.title}`, { level: "down", detail: msg, meta: { requestId: r.id } });
    log("request failed:", r.id, msg);
  }
}

async function processQueue() {
  const { rows } = await q(
    `SELECT * FROM "AgentRequest" WHERE status IN ('queued','approved') ORDER BY "createdAt" ASC LIMIT 3`
  );
  for (const r of rows) await runRequest(r);
}

/* ─────────────── loops ─────────────── */
async function mirrorTick() {
  try { await mirrorKanban(); } catch (e) { log("mirrorKanban err", e.message); }
  try { await mirrorMissionControl(); } catch (e) { log("mirrorMissionControl err", e.message); }
  try { await mirrorCrons(); } catch (e) { log("mirrorCrons err", e.message); }
  try { await mirrorHealth(); } catch (e) { log("mirrorHealth err", e.message); }
  try { await mirrorWiki(); } catch (e) { log("mirrorWiki err", e.message); }
  try { await mirrorCost(); } catch (e) { log("mirrorCost err", e.message); }
  try { await mirrorSkills(); } catch (e) { log("mirrorSkills err", e.message); }
  try { await maybeDailyBrief(); } catch (e) { log("maybeDailyBrief err", e.message); }
  // Mirror gateway health from MC into local Postgres (fills the probe gap)
  try { await probeGateways(); } catch (e) { log("probeGateways err", e.message); }
}

async function main() {
  log(`hermes-bridge up · board=${BOARD} · poll=${POLL_MS}ms · mirror=${MIRROR_MS}ms`);
  await emit("status", "Bridge connected", { level: "up" });
  await mirrorTick();
  setInterval(() => mirrorTick().catch((e) => log("mirror loop", e.message)), MIRROR_MS);
  // queue loop
  const tick = async () => { try { await processQueue(); } catch (e) { log("queue loop", e.message); } finally { setTimeout(tick, POLL_MS); } };
  tick();
}
main().catch((e) => { console.error("fatal", e); process.exit(1); });
