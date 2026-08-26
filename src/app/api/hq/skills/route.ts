import { NextResponse } from "next/server";
import { readdirSync } from "fs";
import { join } from "path";

// ─────────────────────────────────────────────────────────────
// Enumerate installed Hermes skills from a configured SKILLS_BASE
// directory (set in the Coolify env). Falls back gracefully to an
// empty list if no base is configured or the path is unreachable —
// the Skills page then shows a clear "configure SKILLS_BASE" state.
// ─────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";
export const revalidate = 0;

const BASE = process.env.SKILLS_BASE || "";
const MAX_DEPTH = 3;

interface Found {
  name: string;
  path: string;
  category: string | null;
}

function isSkillDir(dir: string): boolean {
  try {
    const names = readdirSync(dir);
    return names.includes("SKILL.md") || names.some((n) => /\.md$/i.test(n));
  } catch {
    return false;
  }
}

function walk(dir: string, depth: number, acc: Found[]): void {
  if (depth > MAX_DEPTH) return;
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.name.startsWith(".")) continue;
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        if (isSkillDir(full)) {
          const parts = dir.split("/");
          const category = parts[parts.length - 1] === "skills" ? null : parts[parts.length - 1];
          acc.push({ name: e.name, path: full, category });
        }
        walk(full, depth + 1, acc);
      }
    }
  } catch {
    /* not a readable dir — skip */
  }
}

export async function GET() {
  if (!BASE) {
    return NextResponse.json({ configured: false, base: null, skills: [] });
  }
  try {
    const skills: Found[] = [];
    walk(BASE, 0, skills);
    skills.sort((a, b) => a.name.localeCompare(b.name));
    return NextResponse.json({ configured: true, base: BASE, count: skills.length, skills });
  } catch (err) {
    return NextResponse.json(
      { configured: true, base: BASE, error: String(err), skills: [] },
      { status: 500 }
    );
  }
}