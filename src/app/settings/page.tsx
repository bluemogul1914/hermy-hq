"use client";

/* ───────────────────────────────────────────────────────────
   Blue Mogul AI · Settings

   System configuration for the Hermy HQ cockpit. Three concerns,
   each backed by Mission Control through the /api/mc proxy:

     1. General settings  — GET /api/settings , POST /api/settings
                           (key/value editor; writes back to MC)
     2. Supabase status   — GET /api/settings/supabase  (read-only)
     3. Tailscale status   — GET /api/settings/tailscale  (read-only)

   MC_URL + MC_AUTH_TOKEN stay server-side; the browser only ever
   talks to this Next.js route, which attaches the bearer token.
   ─────────────────────────────────────────────────────────── */

import { useEffect, useState } from "react";
import {
  Settings,
  RefreshCw,
  Check,
  AlertCircle,
  Database,
  Wifi,
  Server,
} from "lucide-react";
import {
  rise,
  Panel,
  Pill,
  Button,
  Skeleton,
  EmptyState,
  SectionHeader,
} from "@/components/ui/kit";
import { PageHeader } from "@/components/mc/ui";
import { mcGet, mcPost } from "@/lib/mc";

/* ────────────────── types & helpers ────────────────── */

interface SettingRow {
  key: string;
  value: string;
}

interface StatusData {
  connected?: boolean;
  healthy?: boolean;
  status?: string;
  [k: string]: unknown;
}

const inputCls =
  "w-full bg-[var(--surface-2)] border border-[var(--line)] rounded-[var(--r-sm)] px-3 py-2 text-[14px] text-[var(--text)] placeholder:text-[var(--text-3)] focus:outline-none focus:border-[var(--line-strong)] transition-colors";

// Coerce any MC value into an editable / display string.
function fmtValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "object") {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

function normalizeSettings(raw: unknown): SettingRow[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .filter(
        (p): p is { key: string; value: unknown } =>
          typeof p === "object" && p !== null && "key" in p
      )
      .map((p) => ({ key: String(p.key), value: fmtValue(p.value) }));
  }
  if (typeof raw === "object") {
    return Object.entries(raw as Record<string, unknown>).map(([k, v]) => ({
      key: k,
      value: fmtValue(v),
    }));
  }
  return [];
}

function denormalizeSettings(rows: SettingRow[]): Record<string, string> {
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

// Derive a connected/disconnected signal from common status fields.
function computeConnected(data: StatusData | null): boolean | undefined {
  if (!data) return undefined;
  if (typeof data.connected === "boolean") return data.connected;
  if (typeof data.healthy === "boolean") return data.healthy;
  if (typeof data.status === "string") {
    const s = data.status.toLowerCase();
    if (["ok", "connected", "up", "online", "healthy", "active", "success"].includes(s)) return true;
    if (["down", "disconnected", "offline", "error", "failed", "unhealthy", "inactive"].includes(s)) return false;
  }
  return undefined;
}

function statusPill(data: StatusData | null, loading: boolean, error: string | null) {
  if (loading) return <Pill tone="neutral">Loading</Pill>;
  if (error) return <Pill tone="down">Error</Pill>;
  const c = computeConnected(data);
  if (c === true) return <Pill tone="up">Connected</Pill>;
  if (c === false) return <Pill tone="down">Disconnected</Pill>;
  return <Pill tone="neutral">Status</Pill>;
}

function timeAgo(d: Date): string {
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 15) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

/* ────────────────── status card ────────────────── */

function StatusCard({
  title,
  icon,
  data,
  loading,
  error,
  checkedAt,
}: {
  title: string;
  icon: React.ReactNode;
  data: StatusData | null;
  loading: boolean;
  error: string | null;
  checkedAt: Date | null;
}) {
  return (
    <Panel className="p-5 hq-rise" style={rise(3)}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          {icon}
          <span className="eyebrow truncate">{title}</span>
        </div>
        {statusPill(data, loading, error)}
      </div>

      {loading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex justify-between">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-40" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 text-[12.5px] text-[var(--text-3)]">
          <AlertCircle className="w-3.5 h-3.5 text-[var(--down)]" />
          {error}
        </div>
      ) : !data ? (
        <EmptyState
          icon={<Server className="w-5 h-5" />}
          title="No status reported"
          hint="The integration has not reported a status yet."
        />
      ) : (
        <div className="grid grid-cols-[140px_1fr] gap-x-4 gap-y-2.5">
          {Object.entries(data).map(([k, v]) =>
            k === "status" ? null : (
              <div
                key={k}
                className="contents"
              >
                <span className="text-[12.5px] text-[var(--text-3)] break-all">{k}</span>
                <span className="text-[12.5px] text-[var(--text-2)] break-all text-right">
                  {fmtValue(v) || "—"}
                </span>
              </div>
            )
          )}
        </div>
      )}

      {checkedAt && !loading && !error && data && (
        <p className="mt-3 text-[11.5px] text-[var(--text-4)] flex items-center gap-1.5">
          <span className="w-1 h-1 rounded-full" style={{ background: "var(--text-4)" }} />
          Checked {timeAgo(checkedAt)}
        </p>
      )}
    </Panel>
  );
}

/* ────────────────── page ────────────────── */

export default function SettingsPage() {
  /* general settings editor */
  const [rows, setRows] = useState<SettingRow[] | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [original, setOriginal] = useState<Record<string, string>>({});
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  /* integration status */
  const [supabase, setSupabase] = useState<StatusData | null>(null);
  const [supabaseLoading, setSupabaseLoading] = useState(true);
  const [supabaseError, setSupabaseError] = useState<string | null>(null);
  const [supabaseChecked, setSupabaseChecked] = useState<Date | null>(null);

  const [tailscale, setTailscale] = useState<StatusData | null>(null);
  const [tailscaleLoading, setTailscaleLoading] = useState(true);
  const [tailscaleError, setTailscaleError] = useState<string | null>(null);
  const [tailscaleChecked, setTailscaleChecked] = useState<Date | null>(null);

  /* ── data loaders ── */

  async function loadSettings() {
    setSettingsLoading(true);
    try {
      const raw = await mcGet("/settings");
      const r = normalizeSettings(raw);
      const obj = denormalizeSettings(r);
      setRows(r);
      setOriginal(obj);
      setDraft(obj);
      setSettingsError(null);
    } catch (e) {
      setSettingsError(String(e));
      setRows(null);
    } finally {
      setSettingsLoading(false);
    }
  }

  async function loadSupabase() {
    setSupabaseLoading(true);
    try {
      const data = (await mcGet("/settings/supabase")) as StatusData | null;
      setSupabase(data);
      setSupabaseError(null);
      setSupabaseChecked(new Date());
    } catch (e) {
      setSupabaseError(String(e));
      setSupabase(null);
    } finally {
      setSupabaseLoading(false);
    }
  }

  async function loadTailscale() {
    setTailscaleLoading(true);
    try {
      const data = (await mcGet("/settings/tailscale")) as StatusData | null;
      setTailscale(data);
      setTailscaleError(null);
      setTailscaleChecked(new Date());
    } catch (e) {
      setTailscaleError(String(e));
      setTailscale(null);
    } finally {
      setTailscaleLoading(false);
    }
  }

  async function refreshAll() {
    await Promise.all([loadSettings(), loadSupabase(), loadTailscale()]);
  }

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── editor mutations ── */

  const dirty = JSON.stringify(draft) !== JSON.stringify(original);

  function updateSetting(key: string, value: string) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function resetDraft() {
    setDraft({ ...original });
    setSaved(false);
  }

  async function saveSettings() {
    if (!dirty) return;
    setSaving(true);
    try {
      await mcPost("/settings", draft);
      setOriginal({ ...draft });
      setSaved(true);
      setSettingsError(null);
      setTimeout(() => setSaved(false), 1800);
    } catch (e) {
      setSettingsError(String(e));
    } finally {
      setSaving(false);
    }
  }

  /* ── render ── */

  return (
    <div className="w-full mx-auto pt-2 max-w-5xl">
      <PageHeader
        eyebrow="System"
        title="Settings"
        sub="Configure the Hermy HQ cockpit and inspect the live status of the Supabase and Tailscale integrations."
        action={
          <Button
            size="sm"
            variant="ghost"
            onClick={refreshAll}
            className="gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
        }
      />

      {/* ── General settings: key/value editor ── */}
      <div className="mb-2">
        <SectionHeader
          label="General"
          title="Application settings"
          action={
            <div className="flex items-center gap-2 shrink-0">
              {saved ? (
                <Pill tone="up">
                  <Check className="w-3 h-3" /> Saved
                </Pill>
              ) : dirty ? (
                <Pill tone="warn">Unsaved</Pill>
              ) : null}
              <Button size="sm" variant="ghost" onClick={resetDraft} disabled={!dirty}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={saveSettings}
                disabled={!dirty || saving}
              >
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          }
        />
      </div>

      {settingsLoading ? (
        <Panel className="p-5 mb-8 hq-rise" style={rise(1)}>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="grid grid-cols-[160px_1fr] gap-3 items-center">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
        </Panel>
      ) : settingsError ? (
        <Panel className="p-6 mb-8">
          <EmptyState
            icon={<AlertCircle className="w-6 h-6" />}
            title="Settings unavailable"
            hint={settingsError}
            action={
              <Button size="sm" variant="ghost" onClick={loadSettings}>
                <RefreshCw className="w-3.5 h-3.5" /> Retry
              </Button>
            }
          />
        </Panel>
      ) : !rows || rows.length === 0 ? (
        <Panel className="p-6 mb-8">
          <EmptyState
            icon={<Settings className="w-6 h-6" />}
            title="No settings to edit"
            hint="Mission Control returned no key/value pairs. They will appear here once the operator records settings."
          />
        </Panel>
      ) : (
        <Panel className="p-5 mb-8 hq-rise" style={rise(1)}>
          <div className="grid gap-3">
            {rows.map((s, i) => (
              <div
                key={s.key}
                className="grid grid-cols-[160px_1fr] items-center gap-3"
                style={rise(i)}
              >
                <span className="eyebrow !text-[10px] text-[var(--text-4)] break-all">
                  {s.key}
                </span>
                <input
                  value={draft[s.key] ?? ""}
                  onChange={(e) => updateSetting(s.key, e.target.value)}
                  className={inputCls}
                  placeholder={s.value === "" ? "empty" : undefined}
                />
              </div>
            ))}
          </div>
          <div className="rule mt-4" />
          <p className="mt-3 text-[11.5px] text-[var(--text-4)]">
            Edits are local until you Save. Changes are written back to Mission
            Control via the shared MC token.
          </p>
        </Panel>
      )}

      {/* ── Supabase status ── */}
      <SectionHeader label="Integrations" title="Supabase" />
      <StatusCard
        title="Supabase"
        icon={<Database className="w-4 h-4 text-[var(--text-3)]" />}
        data={supabase}
        loading={supabaseLoading}
        error={supabaseError}
        checkedAt={supabaseChecked}
      />

      {/* ── Tailscale status ── */}
      <div className="mt-8">
        <SectionHeader label="Network" title="Tailscale" />
        <StatusCard
          title="Tailscale"
          icon={<Wifi className="w-4 h-4 text-[var(--text-3)]" />}
          data={tailscale}
          loading={tailscaleLoading}
          error={tailscaleError}
          checkedAt={tailscaleChecked}
        />
      </div>
    </div>
  );
}
