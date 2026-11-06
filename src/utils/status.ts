import type { AgentItem, JobStatus, ProjectKnowledgeStatus } from "../types/job.types";

interface StatusDisplay {
  label: string;
  /** The `status-badge--*` color. */
  tone: "pending" | "queued" | "in_progress" | "completed" | "failed";
}

const PENDING: StatusDisplay = { label: "Pending", tone: "pending" };
const QUEUED: StatusDisplay = { label: "Queued", tone: "queued" };
const IN_PROGRESS: StatusDisplay = { label: "In progress", tone: "in_progress" };
const COMPLETED: StatusDisplay = { label: "Completed", tone: "completed" };
const FAILED: StatusDisplay = { label: "Failed", tone: "failed" };

/**
 * One set of words and colors for every status. Reviews, knowledge items, Agents page rows and
 * swarm specialists each have their own values, so they are translated here, not on each page.
 */
const STATUS_DISPLAY: Record<
  JobStatus | ProjectKnowledgeStatus | AgentItem["status"] | "completed",
  StatusDisplay
> = {
  PENDING,
  pending: PENDING,
  QUEUED,
  queued: QUEUED,
  IN_PROGRESS,
  collecting: IN_PROGRESS,
  running: IN_PROGRESS,
  COMPLETED,
  active: COMPLETED,
  completed: COMPLETED,
  FAILED,
  failed: FAILED,
  needs_info: { label: "Needs info", tone: "pending" },
};

/** A value this doesn't know shows as it is, so a new status is still readable. */
export function statusDisplay(status: string | undefined): StatusDisplay {
  if (!status) return { label: "—", tone: "pending" };
  return (STATUS_DISPLAY as Record<string, StatusDisplay>)[status] ?? { label: status, tone: "pending" };
}

export const statusLabel = (status: string | undefined): string => statusDisplay(status).label;

/** Job statuses in the order a job goes through them, for filters. */
export const JOB_STATUSES: JobStatus[] = ["PENDING", "QUEUED", "IN_PROGRESS", "COMPLETED", "FAILED"];

/** Started and not finished: in progress, or queued while it waits for an agent slot. */
export const isInFlight = (status: ProjectKnowledgeStatus | undefined): boolean =>
  status === "queued" || status === "collecting";
