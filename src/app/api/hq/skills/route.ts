import { NextResponse } from "next/server";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { prisma } from "@/lib/prisma";

// ─────────────────────────────────────────────────────────────
// Hermes skills surface for the cockpit.
//
// READ  — preferred source is the `hermes-skills` DataStore row that the
//         hermes-bridge mirrors from the host's ~/.hermes/skills every 30s
//         (the app runs in a container and cannot see the host FS). Falls
//         back to walking SKILLS_BASE if the bridge hasn't populated yet.
//
// WRITE — never touches the filesystem directly. Creating / editing /
//         deleting a skill files an *approval-gated* AgentRequest that the
//         bridge applies on the host only after Tracy approves it in the
//         Agent → Approval Inbox. This is the same gate used for every
//         other side-effecting action.
// ─────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";
export const revalidate = 0;

const BASE = process.env.SKILLS_BASE || "";
const MAX_DEPTH = 3;

interface Found {
  name: string;
  slug: string;
  path: string;
  category: string | null;
  description: string;
  version: string | null;
  bytes: number;
}

function isSkillDir(dir: string): boolean {
  try {
    return readdirSync(dir).includes("SKILL.md");
  } catch {
    return false;
  }
}

function describeSkill(dir: string, base: string): Found | null {
  const slug = dir.split("/").pop() || "";
  let raw = "";
  try {
    raw = readFileSync(join(dir, "SKILL.md"), "utf8");
  } catch {
    return null;
  }
  const m = raw.match(/^---\n([\s\S]*?)\n---/);
  let description = "";
  let version: string | null = null;
  if (m) {
    for (const line of m[1].split("\n")) {
      const kv = line.match(/^([A-Za-z_-]+):\s*(.*)$/);
      if (!kv) continue;
      const v = kv[2].trim().replace(/^["']|["']$/g, "");
      if (kv[1] === "description") description = v;
      if (kv[1] === "version") version = v;
    }
  }
  const rel = dir.slice(base.length).replace(/^\//, "");
  const parts = rel.split("/");
  return { name: slug, slug, path: rel, category: parts.length > 1 ? parts[0] : null, description, version, bytes: raw.length };
}

function walk(dir: string, depth: number, base: string, acc: Found[]): void {
  if (depth > MAX_DEPTH) return;
  try {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith(".")) continue;
      const full = join(dir, e.name);
      if (!e.isDirectory()) continue;
      if (isSkillDir(full)) {
        const d = describeSkill(full, base);
        if (d) acc.push(d);
      }
      walk(full, depth + 1, base, acc);
    }
  } catch {
    /* unreadable dir — skip */
  }
}

export async function GET() {
  // 1. Preferred: the bridge-mirrored snapshot (host truth, container-invisible).
  try {
    const row = await prisma.dataStore.findUnique({ where: { key: "hermes-skills" } });
    const data = row?.data as { skills?: Found[]; base?: string; syncedAt?: string } | null;
    if (data && Array.isArray(data.skills) && data.skills.length > 0) {
      return NextResponse.json({
        configured: true,
        source: "bridge",
        base: data.base ?? null,
        count: data.skills.length,
        syncedAt: data.syncedAt ?? null,
        skills: data.skills,
      });
    }
  } catch (err) {
    console.error("skills: bridge snapshot read failed", err);
  }

  // 2. Fallback: local FS walk (only works if SKILLS_BASE is mounted in).
  if (!BASE) {
    return NextResponse.json({ configured: false, source: null, base: null, skills: [], hint: "Waiting for the hermes-bridge to mirror skills." });
  }
  try {
    const skills: Found[] = [];
    walk(BASE, 0, BASE, skills);
    skills.sort((a, b) => a.slug.localeCompare(b.slug));
    return NextResponse.json({ configured: true, source: "fs", base: BASE, count: skills.length, skills });
  } catch (err) {
    return NextResponse.json({ configured: true, source: "fs", base: BASE, error: String(err), skills: [] }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const action = String(b.action || "write").toLowerCase();
  if (action !== "write" && action !== "delete") {
    return NextResponse.json({ error: "action must be 'write' or 'delete'" }, { status: 400 });
  }

  const slug = String(b.slug || "").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
  if (!slug) return NextResponse.json({ error: "slug is required" }, { status: 400 });
  if (action === "write" && !String(b.body || "").trim()) {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }

  const category = String(b.category || "").replace(/[^a-zA-Z0-9_-]/g, "");
  const payload =
    action === "delete"
      ? { slug, path: b.path ? String(b.path) : category ? `${category}/${slug}` : slug }
      : { slug, category, description: String(b.description || ""), body: String(b.body || ""), version: b.version ? String(b.version) : undefined };

  const row = await prisma.agentRequest.create({
    data: {
      origin: "web",
      kind: action === "delete" ? "skill.delete" : "skill.write",
      title: `${action === "delete" ? "Delete" : "Update"} skill: ${slug}`.slice(0, 200),
      prompt: JSON.stringify(payload),
      sideEffecting: true,
      status: "awaiting_approval",
    },
  });

  return NextResponse.json({
    request: row,
    queued: true,
    message: `Skill "${slug}" queued for approval. Approve it in Agent → Approval Inbox.`,
  });
}
