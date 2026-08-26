import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";

/**
 * Marketing Skills loader for the Morgan (Sales) agent in Blue Mogul AI.
 *
 * Makes the coreyhaines31/marketingskills library (50 Agent-Skills-spec playbooks)
 * available to Morgan's chat so the persona can apply real marketing/sales
 * frameworks instead of generic advice.
 *
 * Two-tired context:
 *  1. FULL INVENTORY INDEX — every skill's name + trigger description, so Morgan
 *     knows the whole arsenal exists and which playbook to reach for.
 *  2. CORE FULL TEXT — the highest-value playbooks for a pipeline / proposals /
 *     ARR / pricing remit, injected verbatim so Morgan can follow their workflows.
 *
 * Loaded from the repo (marketplace-skills/marketing), which Docker `COPY . .`s
 * into the image, so this works at runtime in production.
 */

// Curated core set most relevant to a Sales lead (pipeline, proposals, ARR, pricing).
// Kept deliberately small so the system prompt stays within a sane token budget.
// `product-marketing` is the stated foundation every other skill references.
const CORE_FULL_TEXT = [
  "product-marketing",
  "marketing-plan",
  "offers",
  "pricing",
  "launch",
  "sales-enablement",
  "cold-email",
  "marketing-council",
];

const SKILLS_DIR = join(process.cwd(), "marketplace-skills", "marketing");

let _cache: { index: string; core: string } | null = null;

function frontmatterField(body: string, field: string): string {
  const m = body.match(new RegExp(`^${field}:[ \\t]*["']?(.+?)["']?\\s*$`, "m"));
  return m ? m[1].trim() : "";
}

function fileBody(file: string): string {
  // Strip the YAML frontmatter (--- ... ---) so only the usable instructions ship.
  const raw = readFileSync(file, "utf8");
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  return m ? raw.slice(m[0].length) : raw;
}

function build(): { index: string; core: string } {
  if (!existsSync(SKILLS_DIR)) {
    return {
      index: "Marketing skills library not found in repo (marketplace-skills/marketing).",
      core: "",
    };
  }

  const dirs = readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  const lines: string[] = [];
  const core: string[] = [];
  for (const dir of dirs) {
    const skillFile = join(SKILLS_DIR, dir, "SKILL.md");
    if (!existsSync(skillFile)) continue;
    const raw = readFileSync(skillFile, "utf8");
    const name = frontmatterField(raw, "name") || dir;
    const desc = frontmatterField(raw, "description") || "";
    lines.push(`### ${name}\n${desc}`);
    if (CORE_FULL_TEXT.includes(name)) {
      const body = fileBody(skillFile);
      if (body.trim()) core.push(`\n===== PLAYBOOK: ${name} =====\n${body.trim()}`);
    }
  }

  return {
    index: `You have access to the following ${dirs.length} marketing/sales skills. Read their names and descriptions below to choose the right playbook for the task; apply the relevant methodology rather than generic advice.\n\n${lines.join("\n\n")}`,
    core: core.join("\n"),
  };
}

export function getMarketingSkillsContext(): { index: string; core: string } {
  if (!_cache) _cache = build();
  return _cache;
}

export const MARKETING_CORE_PLAYBOOKS = CORE_FULL_TEXT;