import type {
  ProjectKnowledge,
  GapAnalysisOptions,
  GapAnalysisPhase,
  SecurityReviewOptions,
  SecurityReviewPhase,
  SecurityReviewTask,
} from "../../types/job.types";

export const FOCUS_AREA_LABELS: Record<string, string> = {
  authentication: "Authentication",
  authorization: "Authorization",
  input_handling: "Input handling",
  money_movement: "Money movement",
  secrets_crypto: "Secrets & crypto",
  sensitive_data: "Sensitive data",
  errors_audit: "Errors & audit",
  dependencies: "Dependencies",
  infrastructure: "Infrastructure",
  other: "Other",
};

export const REVIEW_STEPS: Array<{ label: string; phases: SecurityReviewPhase[] }> = [
  { label: "Plan", phases: ["planning"] },
  { label: "Review & verify", phases: ["reviewing"] },
  { label: "Attack chains", phases: ["chains"] },
  { label: "Done", phases: ["done"] },
];

export const GAP_STEPS: Array<{ label: string; phases: GapAnalysisPhase[] }> = [
  { label: "Find gaps", phases: ["planning"] },
  { label: "Specialists", phases: ["reviewing"] },
  { label: "Attack chains", phases: ["chains"] },
  { label: "Done", phases: ["done"] },
];

export const DEFAULT_GAP_OPTIONS: GapAnalysisOptions = {
  maxRounds: 2,
  maxTasksPerRound: 3,
  maxCostUsd: 15,
  verify: "all",
  summarize: true,
};

export const DEFAULT_REVIEW_OPTIONS: SecurityReviewOptions = {
  maxTasks: 8,
  maxCostUsd: 40,
  includePerFlow: true,
  verify: "all",
  summarize: true,
};

export type ReviewTaskEntryValue = {
  findings?: Array<{ threatId?: string; verification?: { verdict?: string } | null }>;
  dismissals?: Array<{ threatId?: string }>;
};

/**
 * A review task with its entry's current status and verdicts. The run's own copy is refreshed
 * only while the run is going, so it goes stale after a retry or an interrupted run.
 */
export function liveTask(t: SecurityReviewTask, knowledge: ProjectKnowledge[]): SecurityReviewTask {
  const entry = t.knowledgeId ? knowledge.find((k) => k.id === t.knowledgeId) : undefined;
  if (!entry) return t;
  const status = entry.status === "needs_info" ? "failed" : entry.status;
  if (status !== "active") return { ...t, status, error: entry.error };
  const { findings = [], dismissals = [] } = (entry.value ?? {}) as ReviewTaskEntryValue;
  const counts = { total: findings.length, confirmed: 0, corrected: 0, rejected: 0, unverified: 0 };
  for (const f of findings) {
    const v = f.verification?.verdict;
    counts[v === "confirmed" || v === "corrected" || v === "rejected" ? v : "unverified"]++;
  }
  const answered = new Set([...findings, ...dismissals].map((x) => x.threatId));
  return {
    ...t,
    status,
    error: null,
    counts,
    checksAnswered: t.checks.filter((c) => answered.has(c.id)).length,
  };
}
