import StatusBadge from "../../components/StatusBadge";
import type { ProjectKnowledgeStatus } from "../../types/job.types";

export function KnowledgeStatusBadge({
  status,
  error,
}: {
  status: ProjectKnowledgeStatus;
  error: string | null;
}) {
  return <StatusBadge status={status} small title={error ?? undefined} />;
}
