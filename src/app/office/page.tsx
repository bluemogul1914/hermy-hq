"use client";

import { useState, useEffect, useCallback } from "react";
import { Building } from "lucide-react";
import { PageHeader } from "@/components/mc/ui";
import OfficeView, { Agent } from "@/components/OfficeView";
import { AgentChat, ChatAgent } from "@/components/AgentChat";

/* ───────────────────────────────────────────────────────────
   Blue Mogul AI · Office — the virtual office floor.
   Every agent in the fleet, as a desk in the org chart.
   Live from /api/agents (Mission Control /api/status),
   polled every 10s. Click a 🗨 icon on any card to chat.
   ─────────────────────────────────────────────────────────── */

export default function OfficePage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [chatAgent, setChatAgent] = useState<ChatAgent | null>(null);

  const loadAgents = useCallback(async () => {
    try {
      const res = await fetch("/api/agents");
      const data = await res.json();
      setAgents(Array.isArray(data) ? data : []);
    } catch {
      /* keep stale data on error */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAgents();
    const interval = setInterval(loadAgents, 10000); // poll every 10s — live activity
    return () => clearInterval(interval);
  }, [loadAgents]);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Company"
          title="Office"
          sub="Virtual office — org chart with agent avatars, status dots, and live activity"
        />
        <div className="p-12 text-center text-[var(--text-3)]">
          <Building className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p>Loading office view...</p>
        </div>
      </div>
    );
  }

  const ceoAgent = agents.find((a) => !a.reportsTo);
  const teamAgents = agents.filter(
    (a) => a.reportsTo && a.id !== ceoAgent?.id
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Company"
        title="Office"
        sub="Virtual office — org chart with agent avatars, status dots, and live activity"
      />

      {agents.length === 0 ? (
        <div className="p-12 text-center text-[var(--text-3)]">
          <Building className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p>No agents in the roster.</p>
        </div>
      ) : (
        <>
          <OfficeView agents={agents} onChat={(a) => setChatAgent(a)} />

          {/* Chat quick-launch strip — my-virtual-world: one-tap chat with any agent */}
          <div className="flex flex-wrap gap-2 pt-2">
            {teamAgents
              .filter((a) => a.status !== "offline")
              .map((a) => (
                <button
                  key={a.id}
                  onClick={() => setChatAgent(a)}
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[12px] text-[var(--text-2)] transition-colors panel-interactive"
                  style={{
                    background: "var(--surface-1)",
                    border: "1px solid var(--line)",
                  }}
                >
                  <span>{a.emoji}</span> Chat with {a.name}
                </button>
              ))}
            {ceoAgent && ceoAgent.status !== "offline" && (
              <button
                onClick={() => setChatAgent(ceoAgent)}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[12px] transition-colors"
                style={{
                  color: "var(--accent)",
                  background: "color-mix(in srgb, var(--accent) 10%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--accent) 28%, transparent)",
                }}
              >
                {ceoAgent.emoji} Chat with {ceoAgent.name}
              </button>
            )}
          </div>
        </>
      )}

      {/* Streaming chat modal — my-virtual-world chat window */}
      {chatAgent && (
        <AgentChat agent={chatAgent} onClose={() => setChatAgent(null)} />
      )}
    </div>
  );
}
