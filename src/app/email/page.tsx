"use client";

import { useEffect, useState } from "react";
import { Mail, Search, Tag, Archive, Inbox, Send } from "lucide-react";
import { rise, Panel, Pill, EmptyState } from "@/components/ui/kit";
import { PageHeader, ErrorState, LoadingGrid } from "@/components/mc/ui";
import { mcGet, mcPost } from "@/lib/mc";

interface EmailMessage {
  id: string;
  sender: string;
  subject: string;
  body_preview: string;
  category: string;
  agency_score: number;
  read: boolean;
  received_at: number;
  draft_status?: string;
  draft?: { generated_by: string; body: string };
}

const categoryColors: Record<string, "accent" | "warn" | "neutral" | "down"> = {
  sponsors: "accent",
  customer_support: "warn",
  partnership: "accent",
  media: "neutral",
  sales: "neutral",
  internal: "down",
};

export default function EmailPage() {
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<EmailMessage | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [categorizing, setCategorizing] = useState<string | null>(null);

  useEffect(() => {
    fetchMessages();
  }, []);

  async function fetchMessages() {
    try {
      const data = await mcGet("email/inbox");
      setMessages((data as any)?.messages || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function recategorize(msg: EmailMessage, category: string) {
    setCategorizing(msg.id);
    try {
      await mcPost(`email/categorize`, { id: msg.id, category });
      await fetchMessages();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCategorizing(null);
    }
  }

  const filtered = messages.filter((m) => {
    if (categoryFilter !== "all" && m.category !== categoryFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return m.sender.toLowerCase().includes(q) || m.subject.toLowerCase().includes(q);
    }
    return true;
  });

  const unreadCount = messages.filter((m) => !m.read).length;
  const categories = Array.from(new Set(messages.map((m) => m.category)));

  if (loading) {
    return (
      <div className="w-full mx-auto pt-2 max-w-5xl">
        <PageHeader eyebrow="Business" title="Email Inbox" />
        <LoadingGrid n={4} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full mx-auto pt-2 max-w-5xl">
        <PageHeader eyebrow="Business" title="Email Inbox" />
        <ErrorState message={error} />
      </div>
    );
  }

  return (
    <div className="w-full mx-auto pt-2 max-w-5xl">
      <PageHeader
        eyebrow="Business"
        title="Email Inbox"
        sub={`${messages.length} messages · ${unreadCount} unread`}
      />

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-3)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sender or subject..."
            className="w-full pl-10 pr-3 py-2 bg-[var(--surface-1)] border border-[var(--line)] rounded-[var(--r-sm)] text-[13px] text-[var(--text)] placeholder-[var(--text-3)] focus:outline-none focus:border-[var(--line-strong)]"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="text-[12.5px] bg-[var(--surface-1)] text-[var(--text-2)] rounded-[var(--r-sm)] px-3 py-2 border border-[var(--line)] focus:outline-none focus:border-[var(--line-strong)]"
        >
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Summary chips */}
      <div className="flex gap-3 mb-5">
        <Pill tone="neutral">{messages.length} total</Pill>
        <Pill tone="warn">{unreadCount} unread</Pill>
        {unreadCount === 0 && (
          <Pill tone="neutral">All caught up</Pill>
        )}
      </div>

      {/* Email list */}
      {filtered.length === 0 ? (
        <Panel className="p-8">
          <EmptyState
            icon={<Mail className="w-6 h-6" />}
            title="No matching emails"
            hint={search || categoryFilter !== "all" ? "Try adjusting your filters." : "Connect an IMAP account in Mission Control settings."}
          />
        </Panel>
      ) : (
        <div className="space-y-2">
          {filtered.map((msg, idx) => {
            const tone = categoryColors[msg.category] || "neutral";
            const scoreColor = msg.agency_score >= 80 ? "var(--up)" :
              msg.agency_score >= 50 ? "var(--warn)" : "var(--text-3)";
            return (
              <div
                key={msg.id}
                className="hq-rise panel p-4 cursor-pointer transition-all"
                style={rise(idx)}
                onClick={() => setSelected(msg)}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[13px] font-medium text-[var(--text)] truncate">
                        {msg.sender}
                      </span>
                      {msg.agency_score > 0 && (
                        <span className="text-[10px] num" style={{ color: scoreColor }}>
                          score {msg.agency_score}
                        </span>
                      )}
                      {!msg.read && (
                        <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />
                      )}
                    </div>
                    <p className="text-[13px] font-medium text-[var(--text)] mb-1 truncate">
                      {msg.subject}
                    </p>
                    <p className="text-[12px] text-[var(--text-3)] line-clamp-2">
                      {msg.body_preview}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Pill tone={tone}>{msg.category}</Pill>
                      {msg.draft_status && (
                        <Pill tone="neutral">{msg.draft_status}</Pill>
                      )}
                    </div>
                  </div>

                  {/* Quick categorize */}
                  <div className="flex flex-col gap-1 shrink-0">
                    {categorizing === msg.id ? (
                      <div className="animate-pulse text-[var(--text-3)] text-[11px]">
                        Categorizing…
                      </div>
                    ) : (
                      <>
                        <select
                          value=""
                          onChange={(e) => {
                            if (e.target.value) {
                              recategorize(msg, e.target.value);
                              e.target.value = "";
                            }
                          }}
                          className="text-[10px] bg-[var(--surface-1)] text-[var(--text-2)] rounded-[var(--r-sm)] px-2 py-1 border border-[var(--line)] focus:outline-none"
                          aria-label="Re-categorize"
                        >
                          <option value="">Categorize…</option>
                          <option value="sponsors">Sponsors</option>
                          <option value="customer_support">Support</option>
                          <option value="sales">Sales</option>
                          <option value="media">Media</option>
                          <option value="internal">Internal</option>
                        </select>

                        {!msg.read && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              // mark as read via MC
                            }}
                            className="text-[10px] text-[var(--text-3)] hover:text-[var(--text)]"
                            title="Mark as read"
                          >
                            <Archive className="w-3 h-3" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}  
        </div>
      )}

      {/* Detail pane (inline, for the selected message) */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
             onClick={() => setSelected(null)}>
          <div className="bg-[var(--surface-1)] border border-[var(--line)] rounded-[var(--r-lg)] max-w-3xl w-full max-h-[85vh]"
               onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-[var(--line)]">
              <p className="text-[11px] text-[var(--text-3)] uppercase mb-1">
                {selected.sender}
              </p>
              <h3 className="text-[15px] font-medium text-[var(--text)]">
                {selected.subject}
              </h3>
              <div className="flex items-center gap-2 mt-2">
                <Pill tone={categoryColors[selected.category] || "neutral"}>
                  {selected.category}
                </Pill>
                <Pill tone="neutral">
                  {new Date(selected.received_at * 1000).toLocaleString()}
                </Pill>
              </div>
            </div>
            <div className="p-5 overflow-y-auto max-h-[60vh]">
              <p className="text-[13px] text-[var(--text-2)] leading-relaxed">
                {selected.body_preview}
              </p>
              {selected.draft && (
                <div className="mt-4 pt-4 border-t border-[var(--line)]">
                  <p className="text-[11px] text-[var(--text-3)] uppercase mb-2">
                    Suggested draft ({selected.draft.generated_by})
                  </p>
                  <pre className="text-[12px] text-[var(--text-2)] whitespace-pre-wrap bg-[var(--bg)]/30 p-3 rounded-[var(--r-sm)]">
                    {selected.draft.body}
                  </pre>
                  {selected.draft_status === "pending" && (
                    <button className="mt-3 px-4 py-2 bg-[var(--accent)] text-[var(--text-1)] rounded-[var(--r-sm)] text-[13px] font-medium">
                      Send via MC →
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
