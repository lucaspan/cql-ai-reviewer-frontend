export type CostJobKind =
  | "github_review"
  | "commit_review"
  | "project_knowledge"
  | "evaluation";
export type CostSource = "ledger" | "live" | "pi" | "evaluation";
export type CostRunKind = "review" | "follow_up" | "collection" | "evaluation";

export interface CostTokens {
  input: number; // uncached input
  cacheRead: number;
  cacheWrite: number;
  output: number;
}

export interface JobCostRow {
  kind: CostJobKind;
  id: string;
  title: string;
  ref: string | null;
  subtype: string | null;
  projectId: string | null; // set for project_knowledge
  status: string;
  createdAt: string;
  runs: number;
  lastRunAt: string | null;
  totalCost: number; // USD
  models: string[]; // may be empty for old jobs
  costSources: CostSource[];
  tokens: CostTokens;
  entries: number | null; // project_knowledge only
}

export interface CostSummary {
  from: string | null;
  to: string | null;
  timeZone: string;
  totalCost: number;
  jobs: number;
  runs: number;
  avgCostPerJob: number;
  byKind: Array<{
    kind: CostJobKind;
    totalCost: number;
    jobs: number;
    runs: number;
  }>;
  byDay: Array<{ day: string; totalCost: number; jobs: number }>; // "YYYY-MM-DD", oldest first, empty days omitted
}

export interface PhaseCost {
  phase: string;
  model: string | null;
  cost: number;
  steps: number | null;
}

export interface JobCostRun {
  runKind: CostRunKind;
  at: string;
  totalCost: number;
  model: string | null;
  models: string[];
  costSource: CostSource;
  steps: number | null;
  tokens: CostTokens;
  phases: PhaseCost[];
  entry: { id: string; key: string; status: string } | null; // project_knowledge only
}

export interface JobCostEntry {
  id: string;
  key: string;
  status: string;
  runs: number;
  totalCost: number;
  lastRunAt: string;
}

export interface RouterLedgerView {
  sessionId: string;
  requests: number;
  costUsd: number;
  segments: Array<{
    agentId: string;
    task: string | null;
    actualModel: string;
    requests: number;
    costUsd: number;
    tokens: CostTokens;
  }>;
}

export interface JobCostDetail {
  job: JobCostRow;
  runs: JobCostRun[]; // oldest first
  entries: JobCostEntry[] | null; // most expensive first; project_knowledge only
  router: RouterLedgerView | null;
}
