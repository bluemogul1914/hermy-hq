"use client";

/* ───────────────────────────────────────────────────────────
   Blue Mogul AI · Skills
   Enumerates the installed Hermes skills from the configured
   SKILLS_BASE directory (see /api/hq/skills). Grouped by
   category where present.
   ─────────────────────────────────────────────────────────── */

import { useEffect, useState } from "react";
import { Book, Package, Sparkles } from "lucide-react";
import { rise, Panel, Pill, EmptyState } from "@/components/ui/kit";
import { PageHeader, ErrorState, LoadingGrid } from "@/components/mc/ui";

interface SkillEntry {
  name: string;
  path: string;
  category: string | null;
}
interface SkillsRes {
  configured: boolean;
  base: string | null;
  count: number;
  skills: SkillEntry[];
  error?: string;
}

export default function SkillsPage() {
  const [data, setData] = useState<SkillsRes | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/hq/skills", { cache: "no-store" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        setData(await r.json());
      } catch (e) {
        setError(String(e));
      }
    })();
  }, []);

  if (error) {
    return (
      <div className="w-full mx-auto pt-2 max-w-4xl">
        <PageHeader eyebrow="Setup" title="Skills" />
        <ErrorState message={error} />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="w-full mx-auto pt-2 max-w-4xl">
        <PageHeader eyebrow="Setup" title="Skills" />
        <LoadingGrid n={3} />
      </div>
    );
  }

  if (!data.configured || data.skills.length === 0) {
    return (
      <div className="w-full mx-auto pt-2 max-w-4xl">
        <PageHeader
          eyebrow="Setup"
          title="Skills"
          sub="The installed Hermes skill library."
        />
        <Panel className="p-6">
          {!data.configured ? (
            <EmptyState
              icon={<Package className="w-6 h-6" />}
              title="Skills source not configured"
              hint="Set SKILLS_BASE in the app environment to point at the Hermes skills directory (e.g. /opt/hermes/skills) and this page will list them."
            />
          ) : (
            <EmptyState
              icon={<Book className="w-6 h-6" />}
              title="No skills found at the configured path"
              hint={`SKILLS_BASE is set, but ${data.base} returned nothing readable.`}
            />
          )}
        </Panel>
      </div>
    );
  }

  const byCategory = new Map<string | null, SkillEntry[]>();
  for (const s of data.skills) {
    const k = s.category;
    if (!byCategory.has(k)) byCategory.set(k, []);
    byCategory.get(k)!.push(s);
  }

  return (
    <div className="w-full mx-auto pt-2 max-w-5xl">
      <PageHeader
        eyebrow="Setup"
        title="Skills"
        sub={`${data.count} skills discovered${data.base ? ` from ${data.base}` : ""}.`}
      />

      {[...byCategory.entries()].map(([cat, skills], gi) => (
        <div key={cat ?? "__root"} className="mb-6 hq-rise" style={rise(gi)}>
          <div className="flex items-center gap-2 mb-3">
            {cat ? (
              <Package className="w-4 h-4 text-[var(--text-3)]" />
            ) : (
              <Sparkles className="w-4 h-4 text-[var(--text-3)]" />
            )}
            <span className="eyebrow uppercase">{cat || "top-level"}</span>
            <Pill tone="neutral">{skills.length}</Pill>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {skills.map((s) => (
              <div
                key={s.path}
                className="panel p-3.5 flex items-center gap-3"
                title={s.path}
              >
                <span
                  className="w-8 h-8 rounded-[9px] flex items-center justify-center shrink-0"
                  style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)", color: "var(--accent)" }}
                >
                  <Book className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-[var(--text)] truncate">{s.name}</p>
                  <p className="text-[10.5px] text-[var(--text-4)] truncate">{s.path}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}