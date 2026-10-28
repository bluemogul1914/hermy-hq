"use client";

import { useEffect, useState } from "react";
import { Bot, Edit, Copy } from "lucide-react";
import { Panel, Button, Pill } from "@/components/ui/kit";
import { PageHeader, LoadingGrid } from "@/components/mc/ui";

export default function PersonaPage() {
  const [personas, setPersonas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/agents")
      .then((r) => r.json())
      .then((data) => {
        const agents = Array.isArray(data) ? data : [];
        // Extract unique personas from agent roles
        const seen = new Set();
        const unique = agents
          .filter((a: any) => {
            const key = a.role;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .map((a: any) => ({
            id: a.id,
            name: a.name,
            role: a.role,
            emoji: a.emoji,
            channel: a.channel,
            status: a.status,
          }));
        setPersonas(unique.slice(0, 12));
        setLoading(false);
      })
      .catch(() => {
        setPersonas([]);
        setLoading(false);
      });
  }, []);

  if (loading) return <LoadingGrid n={6} />;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Company" title="Personas" sub="Agent personas, roles, and channel assignments" action={<Button size="sm">New Persona</Button>} />
      <Panel className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {personas.map((p) => (
            <div key={p.id} className="p-4 rounded-lg bg-[var(--surface-1)] border border-[var(--line)]">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{p.emoji}</span>
                <div>
                  <div className="font-semibold text-[var(--text-1)]">{p.name}</div>
                  <p className="text-sm text-[var(--text-3)]">{p.role}</p>
                </div>
                <Pill className="ml-auto">{p.channel}</Pill>
              </div>
              <div className="mt-3 flex gap-2">
                <Button variant="ghost" size="sm"><Edit className="w-4 h-4" /> Edit</Button>
                <Button variant="ghost" size="sm"><Copy className="w-4 h-4" /> Clone</Button>
              </div>
            </div>
          ))}
          {personas.length === 0 && (
            <p className="text-[var(--text-3)] col-span-2">No personas found</p>
          )}
        </div>
      </Panel>
    </div>
  );
}
