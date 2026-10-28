"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/mc/ui";
import { Panel, Skeleton, Pill } from "@/components/ui/kit";
import { Plus, Trash2, Save, Server, Terminal, Globe } from "lucide-react";

interface McpServer {
  id: string;
  name: string;
  type: "stdio" | "http" | "sse";
  command?: string;
  url?: string;
  env?: Record<string, string>;
  enabled: boolean;
}

export default function McpPage() {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<"stdio" | "http" | "sse">("stdio");
  const [formCommand, setFormCommand] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/mcp");
      const data = await res.json();
      setServers(data || []);
    } catch {
      setServers([]);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleAdd() {
    if (!formName.trim() || !formType) return;
    if (formType === "stdio" && !formCommand.trim()) return;
    if ((formType === "http" || formType === "sse") && !formUrl.trim()) return;

    setSubmitting(true);
    const payload: any = { name: formName, type: formType };
    if (formType === "stdio") payload.command = formCommand;
    if (formType === "http" || formType === "sse") payload.url = formUrl;

    try {
      const res = await fetch("/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const created = await res.json();
        setServers([...servers, created]);
        setShowForm(false);
        setFormName("");
        setFormCommand("");
        setFormUrl("");
        setFormType("stdio");
      }
    } catch {
      // ignore
    }
    setSubmitting(false);
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/mcp?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setServers(servers.filter((s) => s.id !== id));
      }
    } catch {
      // ignore
    }
  }

  function typeIcon(t: string) {
    switch (t) {
      case "stdio": return <Terminal className="w-4 h-4" />;
      case "http": return <Globe className="w-4 h-4" />;
      case "sse": return <Globe className="w-4 h-4" />;
      default: return <Server className="w-4 h-4" />;
    }
  }

  return (
    <div className="w-full mx-auto pt-2 max-w-5xl">
      <PageHeader eyebrow="Setup" title="MCP Servers" sub="Manage Model Context Protocol servers for Hermy HQ integrations"
        action={
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-3 py-1.5 text-[13px] font-medium rounded-[9999px] bg-[var(--gold-gradient)] text-[#0a0f24] hover:opacity-90 transition-opacity flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Add MCP Server
          </button>
        }
      />

      <Panel className="mt-5 p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="eyebrow">Connected MCP Servers</span>
          <span className="text-[11.5px] text-[var(--text-3)]">{servers.length} configured</span>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 bg-[var(--surface-2)] rounded-[10px] animate-pulse" />
            ))}
          </div>
        ) : servers.length === 0 ? (
          <div className="text-center py-8 text-[var(--text-3)] text-[13px]">
            No MCP servers configured. Click "Add MCP Server" to get started.
          </div>
        ) : (
          <div className="space-y-2.5">
            {servers.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 p-3 rounded-[10px] border border-[var(--line)] hover:border-[var(--line-strong)] transition-colors"
              >
                <div className="w-8 h-8 rounded-[8px] bg-[var(--surface-2)] flex items-center justify-center text-[var(--accent)]">
                  {typeIcon(s.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-[var(--text)]">{s.name}</span>
                    <Pill tone={s.enabled ? "up" : "down"} className="text-[10px] px-1.5 py-0.25">
                      {s.enabled ? "● Enabled" : "● Disabled"}
                    </Pill>
                  </div>
                  <div className="text-[11px] text-[var(--text-3)] mt-0.5">
                    {s.type === "stdio" && <>Command: <code className="text-[var(--text-2)]">{s.command}</code></>}
                    {(s.type === "http" || s.type === "sse") && <>Endpoint: <code className="text-[var(--text-2)]">{s.url}</code></>}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(s.id)}
                  className="p-1.5 text-[var(--text-3)] hover:text-[var(--text)] transition-colors rounded-[6px] hover:bg-[var(--surface-2)]"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* Add MCP Server Form */}
      {showForm && (
        <Panel className="mt-5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Save className="w-4 h-4 text-[var(--accent)]" />
            <span className="eyebrow">Add New MCP Server</span>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-[11.5px] font-medium text-[var(--text-2)] mb-1">Name</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Filesystem, Git, Notion"
                className="w-full px-3 py-2 text-[13px] bg-[var(--surface-1)] border border-[var(--line)] rounded-[8px] text-[var(--text)] placeholder-[var(--text-3)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              />
            </div>
            <div>
              <label className="block text-[11.5px] font-medium text-[var(--text-2)] mb-1">Type</label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value as any)}
                className="w-full px-3 py-2 text-[13px] bg-[var(--surface-1)] border border-[var(--line)] rounded-[8px] text-[var(--text)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              >
                <option value="stdio">stdio (local command)</option>
                <option value="http">HTTP (remote server)</option>
                <option value="sse">SSE (server-sent events)</option>
              </select>
            </div>
            {formType === "stdio" && (
              <div>
                <label className="block text-[11.5px] font-medium text-[var(--text-2)] mb-1">Command</label>
                <input
                  type="text"
                  value={formCommand}
                  onChange={(e) => setFormCommand(e.target.value)}
                  placeholder="e.g. npx -y @modelcontextprotocol/server-filesystem /path/to/root"
                  className="w-full px-3 py-2 text-[12px] font-mono bg-[var(--surface-1)] border border-[var(--line)] rounded-[8px] text-[var(--text-2)] placeholder-[var(--text-4)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                />
              </div>
            )}
            {(formType === "http" || formType === "sse") && (
              <div>
                <label className="block text-[11.5px] font-medium text-[var(--text-2)] mb-1">URL</label>
                <input
                  type="url"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  placeholder="e.g. https://mcp-server.example.com"
                  className="w-full px-3 py-2 text-[12px] font-mono bg-[var(--surface-1)] border border-[var(--line)] rounded-[8px] text-[var(--text-2)] placeholder-[var(--text-4)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                />
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleAdd}
                disabled={submitting || !formName.trim()}
                className="px-4 py-2 text-[13px] font-medium rounded-[9999px] bg-[var(--gold-gradient)] text-[#0a0f24] hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Saving..." : "Save Server"}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-[13px] font-medium rounded-[9999px] bg-[var(--surface-1)] border border-[var(--line)] text-[var(--text-2)] hover:text-[var(--text)] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </Panel>
      )}
    </div>
  );
}
