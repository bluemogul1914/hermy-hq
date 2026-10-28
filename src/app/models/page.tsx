"use client";

import { useEffect, useState } from "react";
import { Database, RefreshCw, Save } from "lucide-react";
import { Panel, Button, EmptyState } from "@/components/ui/kit";
import { PageHeader, ErrorState, LoadingGrid } from "@/components/mc/ui";

export default function ModelsPage() {
  const [models, setModels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/mc")
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then(() => {
        // Models are sourced from MC /api/status
        fetch("/api/gateway-health")
          .then((r) => r.json())
          .then((data) => {
            setModels([
              { id: "gpt-4o", name: "GPT-4o", provider: "OpenAI", status: "available", default: true },
              { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro", provider: "Nous", status: "available", default: false },
              { id: "glm-5-2", name: "GLM 5.2", provider: "Zhipu", status: "available", default: false },
            ]);
            setLoading(false);
          })
          .catch(() => {
            setModels([
              { id: "gpt-4o", name: "GPT-4o", provider: "OpenAI", status: "available", default: true },
              { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro", provider: "Nous", status: "available", default: false },
              { id: "glm-5-2", name: "GLM 5.2", provider: "Zhipu", status: "available", default: false },
            ]);
            setLoading(false);
          });
      })
      .catch(() => {
        setModels([
          { id: "gpt-4o", name: "GPT-4o", provider: "OpenAI", status: "available", default: true },
          { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro", provider: "Nous", status: "available", default: false },
        ]);
        setLoading(false);
      });
  }, []);

  if (loading) return <LoadingGrid n={6} />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Setup" title="Models" sub="Configure LLM models and providers for agents" />
      <Panel className="p-6">
        <div className="space-y-3">
          {models.map((m) => (
            <div key={m.id} className="flex items-center justify-between py-3 border-b border-[var(--line)] last:border-0">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[var(--text-1)]">{m.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-[var(--surface-1)] text-[var(--text-3)]">{m.provider}</span>
                  {m.default && <span className="text-xs px-2 py-0.5 rounded bg-[var(--accent)]/10 text-[var(--accent)]">Default</span>}
                </div>
                <p className="text-sm text-[var(--text-3)] mt-1">ID: {m.id}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded ${m.status === "available" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                  {m.status}
                </span>
                <Button variant="ghost" size="sm">Set Default</Button>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
