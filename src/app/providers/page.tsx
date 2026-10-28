"use client";

import { useEffect, useState } from "react";
import { Building, ExternalLink, Key } from "lucide-react";
import { Panel, Button } from "@/components/ui/kit";
import { PageHeader, LoadingGrid } from "@/components/mc/ui";

export default function ProvidersPage() {
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setProviders([
      { id: "google", name: "Google", type: "OAuth", status: "connected" },
      { id: "github", name: "GitHub", type: "OAuth", status: "connected" },
      { id: "nous", name: "Nous Portal", type: "API Key", status: "connected" },
      { id: "openai", name: "OpenAI", type: "API Key", status: "disconnected" },
      { id: "anthropic", name: "Anthropic", type: "API Key", status: "disconnected" },
    ]);
    setLoading(false);
  }, []);

  if (loading) return <LoadingGrid n={5} />;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Setup" title="Providers" sub="Manage API keys and OAuth connections" />
      <Panel className="p-6">
        <div className="space-y-3">
          {providers.map((p) => (
            <div key={p.id} className="flex items-center justify-between py-3 border-b border-[var(--line)] last:border-0">
              <div className="flex items-center gap-3">
                <Building className="w-5 h-5 text-[var(--text-3)]" />
                <div>
                  <div className="font-medium text-[var(--text-1)]">{p.name}</div>
                  <p className="text-sm text-[var(--text-3)]">{p.type}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-0.5 rounded ${p.status === "connected" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                  {p.status}
                </span>
                <Button variant="ghost" size="sm">
                  <Key className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
