"use client";

import { useState } from "react";
import { Search, Globe, BookOpen, Sparkles } from "lucide-react";
import { Panel, Button, EmptyState } from "@/components/ui/kit";
import { PageHeader } from "@/components/mc/ui";

interface SearchResult {
  id: string;
  title: string;
  type: "skill" | "agent" | "page" | "wiki";
  description: string;
}

export default function DiscoverPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const searchItems: SearchResult[] = [
    { id: "1", title: "Fiber Deployment Skills", type: "skill", description: "Rural WISP deployment procedures" },
    { id: "2", title: "Cybersecurity Audit", type: "skill", description: "Security audit workflows" },
    { id: "3", title: "JACKIE", type: "agent", description: "Fleet orchestrator" },
    { id: "4", title: "HUNTER", type: "agent", description: "Discovery & Research" },
    { id: "5", title: "Agent Chat", type: "page", description: "Talk Mode — chat with agents" },
    { id: "6", title: "Gateway Health", type: "page", description: "Monitor gateway connectivity" },
  ];

  const handleSearch = (q: string) => {
    setQuery(q);
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    const filtered = searchItems.filter(
      (item) =>
        item.title.toLowerCase().includes(q.toLowerCase()) ||
        item.description.toLowerCase().includes(q.toLowerCase()) ||
        item.type.toLowerCase().includes(q.toLowerCase()),
    );
    setResults(filtered);
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Discover" title="Discover" sub="Search skills, agents, pages, and knowledge base" />
      <Panel className="p-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-3)]" />
          <input
            type="text"
            placeholder="Search for skills, agents, pages, or knowledge..."
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[var(--surface-1)] text-[var(--text-1)] placeholder-[var(--text-3)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
        </div>
        {loading && <p className="text-sm text-[var(--text-3)] mt-4">Searching...</p>}
        {!loading && results.length === 0 && query && (
          <EmptyState title="No results found" hint={`No matches for "${query}"`} />
        )}
        {!loading && results.length === 0 && !query && (
          <div className="mt-8 space-y-2">
            <p className="text-sm text-[var(--text-3)]">Quick links:</p>
            <div className="flex flex-wrap gap-2">
              {searchItems.slice(0, 6).map((item) => (
                <span key={item.id} className="text-xs px-3 py-1 bg-[var(--surface-1)] rounded-full text-[var(--text-2)]">{item.title}</span>
              ))}
            </div>
          </div>
        )}
        {!loading && results.length > 0 && (
          <div className="mt-4 space-y-2">
            {results.map((item) => (
              <div key={item.id} className="p-3 rounded-lg hover:bg-[var(--surface-1)] transition-colors cursor-pointer">
                <div className="flex items-start gap-3">
                  {item.type === "skill" && <Sparkles className="w-5 h-5 text-[var(--accent)] mt-0.5" />}
                  {item.type === "agent" && <Globe className="w-5 h-5 text-[var(--text-2)] mt-0.5" />}
                  {item.type === "page" && <BookOpen className="w-5 h-5 text-[var(--text-2)] mt-0.5" />}
                  {item.type === "wiki" && <BookOpen className="w-5 h-5 text-[var(--text-2)] mt-0.5" />}
                  <div>
                    <div className="font-medium text-[var(--text-1)]">{item.title}</div>
                    <p className="text-sm text-[var(--text-3)]">{item.description}</p>
                    <span className="text-xs px-2 py-0.5 rounded bg-[var(--surface-2)] text-[var(--text-3)]">{item.type}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
