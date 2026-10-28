import type {
  ProjectKnowledgeStatus,
} from "../../types/job.types";

export function KnowledgeStatusBadge({
  status,
  error,
}: {
  status: ProjectKnowledgeStatus;
  error: string | null;
}) {
  const cls: Record<ProjectKnowledgeStatus, string> = {
    pending: "pj-status--pending",
    collecting: "pj-status--progress",
    active: "pj-status--done",
    failed: "pj-status--failed",
    needs_info: "pj-status--pending",
  };
  const label: Record<ProjectKnowledgeStatus, string> = {
    pending: "Pending",
    collecting: "Collecting",
    active: "Active",
    failed: "Failed",
    needs_info: "Needs info",
  };
  return (
    <span
      className={`pj-status pj-status--sm ${cls[status]}`}
      title={error ?? undefined}
    >
      {label[status]}
    </span>
  );
}
