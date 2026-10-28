"use client";

import { useEffect, useState } from "react";
import { Calendar, Clock, Play, Pause, Settings } from "lucide-react";
import { Panel, Button, Pill, EmptyState } from "@/components/ui/kit";
import { PageHeader, LoadingGrid } from "@/components/mc/ui";

interface CronJob {
  id: string;
  name: string;
  schedule: string;
  command: string;
  status: "active" | "paused";
}

export default function SchedulesPage() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/mc")
      .then(() => {
        // In the real implementation, this would query the cron job list
        setJobs([
          { id: "1", name: "Agent Heartbeat Sync", schedule: "*/30 * * * *", command: "hermes heartbeat sync", status: "active" },
          { id: "2", name: "Memory Wiki Backup", schedule: "0 2 * * *", command: "hermes memory backup", status: "active" },
          { id: "3", name: "Cost Report", schedule: "0 9 * * 1", command: "hermes cost report --daily", status: "paused" },
        ]);
        setLoading(false);
      })
      .catch(() => {
        setJobs([]);
        setLoading(false);
      });
  }, []);

  if (loading) return <LoadingGrid n={4} />;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Setup" title="Schedules" sub="Manage cron jobs and automation schedules" action={<Button size="sm">New Schedule</Button>} />
      <Panel className="p-6">
        <div className="space-y-3">
          {jobs.map((job) => (
            <div key={job.id} className="flex items-center justify-between py-3 border-b border-[var(--line)] last:border-0">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[var(--text-3)]" />
                  <span className="font-medium text-[var(--text-1)]">{job.name}</span>
                </div>
                <p className="text-sm text-[var(--text-3)] mt-1 font-mono">{job.schedule}</p>
                <p className="text-xs text-[var(--text-3)]">{job.command}</p>
              </div>
              <div className="flex items-center gap-2">
                <Pill className={job.status === "active" ? "bg-green-500/10 text-green-400" : "bg-gray-500/10 text-gray-400"}>
                  {job.status}
                </Pill>
                <Button variant="ghost" size="sm"><Play className="w-4 h-4" /></Button>
                <Button variant="ghost" size="sm"><Settings className="w-4 h-4" /></Button>
              </div>
            </div>
          ))}
          {jobs.length === 0 && (
            <EmptyState title="No schedules" hint="Create a cron job to automate recurring tasks" />
          )}
        </div>
      </Panel>
    </div>
  );
}
