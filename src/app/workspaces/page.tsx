import { PanelsTopLeft } from "lucide-react";
import { Scaffold } from "@/components/mc/ui";

export default function WorkspacesPage() {
  return (
    <Scaffold
      eyebrow="Setup"
      title="Workspaces"
      sub="Isolated working contexts for the fleet."
      icon={<PanelsTopLeft className="w-7 h-7" />}
      source="Workspace records will be surfaced here once a source of truth is attached. Track this in ITFlow (the projects/workspaces system of record) meanwhile."
    />
  );
}