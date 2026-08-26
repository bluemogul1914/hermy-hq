import { Boxes } from "lucide-react";
import { Scaffold } from "@/components/mc/ui";

export default function ArtifactsPage() {
  return (
    <Scaffold
      eyebrow="Setup"
      title="Artifacts"
      sub="Produced outputs and evidence from agent work."
      icon={<Boxes className="w-7 h-7" />}
      source="Artifact/handoff records will land here once a source of truth is attached (e.g. Nextcloud or ITFlow documents)."
    />
  );
}