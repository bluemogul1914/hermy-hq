"use client";

/* ───────────────────────────────────────────────────────────
   Blue Mogul AI · Skills
   Reads the installed Hermes skill library from the bridge
   snapshot (/api/hq/skills) and lets Tracy add / edit / delete.

   Every write is approval-gated: it files an AgentRequest which
   the host bridge only applies after approval in the Agent tab.
   The container never touches the host filesystem directly.
   ─────────────────────────────────────────────────────────── */

import { useEffect, useMemo, useState } from "react";
import { Book, Package, Sparkles, Plus, Pencil, Trash2, Search, X } from "lucide-react";
import { rise, Panel, Pill, EmptyState } from "@/components/ui/kit";
import { PageHeader, ErrorState, LoadingGrid } from "@/components/mc/ui";

interface SkillEntry {
  name: string;
  slug: string;
  path: string;
  category: string | null;
  description: string;
  version: string | null;
  bytes: number;
}
interface SkillsRes {
  configured: boolean;
  source: string | null;
  base: string | null;
  count?: number;
  syncedAt?: string | null;
  skills: SkillEntry[];
  error?: string;
  hint?: string;
}

interface Draft {
  originalSlug: string | null; // null = create
  slug: string;
  category: string;
  description: string;
  body: string;
}

const EMPTY_DRAFT: Draft = { originalSlug: null, slug: "", category: "", description: "", body: "" };

export default function SkillsPage() {
  const [data, setData] = useState<SkillsRes | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function load() {
    try {
      const r = await fetch("/api/hq/skills", { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData(await r.json());
    } catch (e) {
      setError(String(e));
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function submit(action: "write" | "delete", d: Draft) {
    setBusy(true);
    setNote(null);
    try {
      const r = await fetch("/api/hq/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          slug: d.slug,
          category: d.category,
          description: d.description,
          body: d.body,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setNote(
        action === "delete"
          ? `Delete of "${d.slug}" is queued for approval — approve it in the Agent tab.`
          : `"${d.slug}" is queued for approval — approve it in the Agent tab, then it lands on disk.`
      );
      setDraft(null);
      load();
    } catch (e) {
      setNote(`Failed: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  const filtered = useMemo(() => {
    const all = data?.skills ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (s) =>
        s.slug.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        (s.category ?? "").toLowerCase().includes(q)
    );
  }, [data, query]);

  const byCategory = useMemo(() => {
    const m = new Map<string | null, SkillEntry[]>();
    for (const s of filtered) {
      if (!m.has(s.category)) m.set(s.category, []);
      m.get(s.category)!.push(s);
    }
    return m;
  }, [filtered]);

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

  const Header = (
    <PageHeader
      eyebrow="Setup"
      title="Skills"
      sub={
        data.count
          ? `${data.count} skills installed${data.source === "bridge" ? " (live from the host)" : ""}. Edits are approval-gated.`
          : "The installed Hermes skill library."
      }
    />
  );

  return (
    <div className="w-full mx-auto pt-2 max-w-5xl">
      {Header}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-4)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search skills…"
            className="w-full pl-9 pr-3 py-2 rounded-[10px] bg-[var(--surface-1)] border border-[var(--line)] text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
          />
        </div>
        <button
          onClick={() => {
            setNote(null);
            setDraft({ ...EMPTY_DRAFT });
          }}
          className="flex items-center gap-2 px-3.5 py-2 rounded-[10px] text-[13px] font-medium text-[var(--text)] border border-[var(--line)] hover:bg-[var(--surface-1)] transition-colors"
        >
          <Plus className="w-4 h-4" /> New skill
        </button>
      </div>

      {note && (
        <div
          className="mb-4 px-4 py-3 rounded-[10px] text-[12.5px]"
          style={{
            background: "color-mix(in srgb, var(--accent) 10%, transparent)",
            color: "var(--text)",
            border: "1px solid color-mix(in srgb, var(--accent) 25%, transparent)",
          }}
        >
          {note}
        </div>
      )}

      {filtered.length === 0 ? (
        <Panel className="p-6">
          <EmptyState
            icon={<Package className="w-6 h-6" />}
            title={query ? "No skills match that search" : "No skills yet"}
            hint={
              query
                ? "Try a different term."
                : data.hint || "Install skills on the host, or create one with “New skill”."
            }
          />
        </Panel>
      ) : (
        [...byCategory.entries()].map(([cat, skills], gi) => (
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
                <div key={s.path} className="panel p-3.5 group" title={s.description || s.path}>
                  <div className="flex items-start gap-3">
                    <span
                      className="w-8 h-8 rounded-[9px] flex items-center justify-center shrink-0"
                      style={{
                        background: "color-mix(in srgb, var(--accent) 12%, transparent)",
                        color: "var(--accent)",
                      }}
                    >
                      <Book className="w-4 h-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-[var(--text)] truncate">{s.slug}</p>
                      <p className="text-[10.5px] text-[var(--text-4)] truncate">{s.category || "top-level"}</p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        title="Edit (approval-gated)"
                        onClick={(e) => {
                          e.stopPropagation();
                          setNote(null);
                          setDraft({
                            originalSlug: s.slug,
                            slug: s.slug,
                            category: s.category ?? "",
                            description: s.description ?? "",
                            body: "",
                          });
                        }}
                        className="p-1.5 rounded-[7px] hover:bg-[var(--surface-2)] text-[var(--text-3)] hover:text-[var(--text)]"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        title="Delete (approval-gated)"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Queue deletion of skill "${s.slug}"? It needs approval in the Agent tab.`))
                            submit("delete", { ...EMPTY_DRAFT, slug: s.slug, category: s.category ?? "" });
                        }}
                        className="p-1.5 rounded-[7px] hover:bg-[var(--surface-2)] text-[var(--text-3)] hover:text-[var(--danger,red)]"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {s.description && (
                    <p className="mt-2 text-[11.5px] leading-snug text-[var(--text-3)] line-clamp-2">{s.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {draft && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.55)" }}
          onClick={() => !busy && setDraft(null)}
        >
          <div
            className="w-full max-w-2xl rounded-[14px] border border-[var(--line)] p-5 max-h-[88vh] overflow-y-auto"
            style={{ background: "var(--card, var(--surface-2))" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[15px] font-semibold text-[var(--text)]">
                {draft.originalSlug ? `Edit skill · ${draft.originalSlug}` : "New skill"}
              </h2>
              <button
                onClick={() => !busy && setDraft(null)}
                className="p-1.5 rounded-[7px] hover:bg-[var(--surface-1)] text-[var(--text-3)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <label className="block">
                <span className="eyebrow block mb-1">Slug</span>
                <input
                  value={draft.slug}
                  disabled={!!draft.originalSlug}
                  onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
                  placeholder="my-new-skill"
                  className="w-full px-3 py-2 rounded-[9px] bg-[var(--surface-1)] border border-[var(--line)] text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] disabled:opacity-60"
                />
              </label>
              <label className="block">
                <span className="eyebrow block mb-1">Category (optional)</span>
                <input
                  value={draft.category}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                  placeholder="productivity"
                  className="w-full px-3 py-2 rounded-[9px] bg-[var(--surface-1)] border border-[var(--line)] text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                />
              </label>
            </div>

            <label className="block mb-3">
              <span className="eyebrow block mb-1">Description</span>
              <input
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                placeholder="Use when <trigger>. One line on what it does."
                className="w-full px-3 py-2 rounded-[9px] bg-[var(--surface-1)] border border-[var(--line)] text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
              />
            </label>

            <label className="block mb-2">
              <span className="eyebrow block mb-1">SKILL.md body</span>
              <textarea
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                rows={10}
                placeholder={"# My skill\n\nStep 1…\nStep 2…"}
                className="w-full px-3 py-2 rounded-[9px] bg-[var(--surface-1)] border border-[var(--line)] text-[12.5px] font-mono text-[var(--text)] outline-none focus:border-[var(--accent)]"
              />
            </label>

            <p className="text-[11.5px] text-[var(--text-4)] mb-4">
              Writes land on the host filesystem only after you approve the request in{" "}
              <span className="text-[var(--text-3)]">Agent → Approval Inbox</span>.
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => !busy && setDraft(null)}
                className="px-3.5 py-2 rounded-[10px] text-[13px] text-[var(--text-2)] hover:text-[var(--text)]"
              >
                Cancel
              </button>
              <button
                disabled={busy || !draft.slug.trim() || !draft.body.trim()}
                onClick={() => submit("write", draft)}
                className="px-4 py-2 rounded-[10px] text-[13px] font-medium text-[#0b0b0c] disabled:opacity-50"
                style={{ background: "var(--accent)" }}
              >
                {busy ? "Queueing…" : "Queue for approval"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
