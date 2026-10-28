import type { RouterOverride } from "./llm.types";

export type JobStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED";

export interface GithubReviewJob {
  id: string;
  githubOwner: string;
  githubRepo: string;
  githubBranch: string;
  githubCommit?: string | null;
  status: JobStatus;
  reviewJobType?: string | null;
  reviewJobTypeVersion?: number | null;
  dedupKey?: string;
  publishedLink?: string | null;
  error?: string | null;
  requestPayload?: unknown;
  results?: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface GithubReviewJobActivity {
  id: string;
  jobId: string;
  level?: string;
  message: string;
  createdAt: string;
  metadata?: unknown;
}

export interface JDevApiResponse<T> {
  message: string;
  statusCode: number;
  data: T;
}

export interface GetJobsParams {
  id?: string;
  status?: JobStatus;
  githubOwner?: string;
  githubRepo?: string;
  githubBranch?: string;
  dedupKey?: string;
  includeResults?: boolean;
  includeMetrics?: boolean;
}

export interface ReviewMetrics {
  model: string;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalCost: number;
}

export interface DependentRepo {
  githubOwner: string;
  githubRepo: string;
  githubBranch: string;
  dependencyContext?: string;
}

export interface CreateJobParams {
  githubOwner: string;
  githubRepo: string;
  githubBranch: string;
  dedupKey?: string;
  reviewJobType?: string;
  dependentRepos?: DependentRepo[];
}

export interface ProcessJobResult {
  processed: boolean;
  jobId?: string;
}

export interface CreateJobResult {
  created: boolean;
  jobId?: string;
  error?: string;
}

export interface DeleteJobResult {
  deleted: boolean;
  jobId?: string;
}

export interface FollowUpResult {
  processed: boolean;
  newFindings?: number;
  error?: string;
}

export interface KnowledgeFile {
  filename: string;
  content: string;
}

export interface ReviewJobType {
  id: string;
  name: string;
  description: string | null;
  systemPromptTemplate: string;
  modulePromptTemplate: string;
  summaryPrompt: string;
  diffUserPromptTemplate: string;
  knowledgeFiles: KnowledgeFile[];
  createdAt: string;
  updatedAt: string;
}

export interface ReviewJobTypeVersion {
  id: string;
  reviewJobTypeId: string;
  version: number;
  name: string;
  description: string | null;
  systemPromptTemplate: string;
  modulePromptTemplate: string;
  summaryPrompt: string;
  diffUserPromptTemplate: string;
  knowledgeFiles: KnowledgeFile[];
  createdAt: string;
}

export interface IssueJobRow {
  job_id: string;
  repo: string;
  branch: string;
  commit: string | null;
  job_type: string;
  confluence_link: string | null;
  total_issues: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  app_cat_id: string | null;
  sto_emails: string[];
  manager_emails: string[];
  created_at: string;
  updated_at: string;
}

export interface IssueDetailRow {
  job_id: string;
  finding_id: string;
  repo: string;
  branch: string;
  commit: string | null;
  job_type: string;
  title: string;
  severity: string;
  category: string;
  file: string;
  line_start: number | null;
  line_end: number | null;
  evidence: string;
  why_dangerous: string;
  failure_mode: string;
  recommended_fix: string;
  refactor_direction: string;
  what_would_confirm: string | null;
  logging_level: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface MdJobRow {
  job_id: string;
  repo: string;
  branch: string;
  commit: string | null;
  job_type: string;
  confluence_link: string | null;
  total_md: number;
  label_breakdown: Record<string, number>;
  audience_breakdown: Record<string, number>;
  app_cat_id: string | null;
  sto_emails: string[];
  manager_emails: string[];
  created_at: string;
  updated_at: string;
}

export interface MdDetailRow {
  job_id: string;
  repo: string;
  branch: string;
  commit: string | null;
  job_type: string;
  path: string;
  title: string;
  description: string;
  label: string;
  audience: string;
  created_at: string;
  updated_at: string;
}

export interface MdLabelRow {
  label: string;
  total_count: number;
}

export interface MdAudienceRow {
  audience: string;
  total_count: number;
}

export interface DependentRepoConfig {
  githubOwner: string;
  githubRepo: string;
  githubBranch: string;
  dependencyContext: string;
}

export interface RepoConfig {
  id: string;
  githubOwner: string;
  githubRepo: string;
  githubBranch: string | null;
  jobTypes: string[] | null;
  dependentRepos: DependentRepoConfig[] | null;
  confluenceEmails: string[] | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

// --- Pagination (backend standard) ---

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface Paginated<T> {
  data: T[];
  pagination: PaginationMeta;
}

export interface ListParams {
  page?: number;
  limit?: number;
  orderBy?: string;
  order?: "ASC" | "DESC";
}

// --- Threat-modeling projects (AI vuln pipeline) ---

export interface ProjectRepo {
  id: string;
  projectId: string;
  githubOwner: string;
  githubRepo: string;
  githubBranch: string;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  repos?: ProjectRepo[];
}

export type ProjectKnowledgeStatus =
  | "pending"
  | "collecting"
  | "active"
  | "failed"
  | "needs_info";

export interface ProjectKnowledge {
  id: string;
  projectId: string;
  knowledgeType: string;
  key: string;
  value: Record<string, unknown>;
  source: string;
  status: ProjectKnowledgeStatus;
  error: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

/** Options of a security review run (POST /project/:id/security-review). */
export interface SecurityReviewOptions {
  maxTasks: number;
  maxCostUsd: number;
  includePerFlow: boolean;
  verify: "all" | "high";
  summarize: boolean;
}

export type SecurityReviewPhase = "planning" | "reviewing" | "chains" | "done" | "failed";

export interface SecurityReviewFindingCounts {
  total: number;
  confirmed: number;
  corrected: number;
  rejected: number;
  unverified: number;
}

export interface SecurityReviewTask {
  id: string;
  wave: 1 | 2;
  focusArea: string;
  title: string;
  repos: string[];
  paths: string[];
  endpoints: string[];
  flows: string[];
  brief: string;
  checks: Array<{ id: string; description: string }>;
  knowledgeId: string | null;
  status: Exclude<ProjectKnowledgeStatus, "needs_info">;
  error?: string | null;
  counts?: SecurityReviewFindingCounts;
  checksAnswered?: number;
  costUsd?: number;
}

export interface SecurityReviewChain {
  title: string;
  severity: string;
  entryPoint: string;
  impact: string;
  narrative: string;
  steps: Array<{ findingRef: string; role: string; title?: string; location?: string }>;
}

/** The value of a `security_review` knowledge entry. */
export interface SecurityReviewValue {
  options?: SecurityReviewOptions;
  runId?: string | null;
  phase?: SecurityReviewPhase | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  planSummary?: string | null;
  tasks?: SecurityReviewTask[];
  perFlow?: { total: number; done: number; failed: number; findings: number } | null;
  coverage?: CoverageRow[];
  chains?: SecurityReviewChain[];
  chainSummary?: string | null;
  spentUsd?: number;
  notes?: string[];
}

/** Per repository: source files, how many an agent opened, and the largest unread directories. */
export interface CoverageRow {
  repo: string;
  sourceFiles: number;
  filesRead: number;
  unreadDirs: Array<{ dir: string; sourceFiles: number }>;
}

/** Options of a gap analysis (POST /project/:id/gap-analysis). */
export interface GapAnalysisOptions {
  maxRounds: number;
  maxTasksPerRound: number;
  maxCostUsd: number;
  verify: "all" | "high";
  summarize: boolean;
}

export type GapAnalysisPhase = "planning" | "reviewing" | "chains" | "done" | "failed";

/** The value of a `gap_analysis` knowledge entry. */
export interface GapAnalysisValue {
  options?: GapAnalysisOptions;
  runId?: string | null;
  /** The review run it built on; its results stop counting once a newer review runs. */
  baseRunId?: string | null;
  phase?: GapAnalysisPhase | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  rounds?: Array<{ round: number; summary: string; taskIds: string[] }>;
  tasks?: SecurityReviewTask[];
  coverageBefore?: CoverageRow[];
  coverage?: CoverageRow[];
  chains?: SecurityReviewChain[];
  chainSummary?: string | null;
  spentUsd?: number;
  notes?: string[];
}

export interface ProjectKnowledgeActivity {
  id: string;
  projectKnowledgeId: string;
  version: number;
  action: string;
  message: string;
  metadata?: unknown;
  createdAt: string;
}

export interface ProjectKnowledgeHistory {
  id: string;
  projectKnowledgeId: string;
  value: Record<string, unknown>;
  source: string;
  version: number;
  metrics: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    totalCost: number;
    steps: number;
    compactions: number;
    durationMs: number;
  } | null;
  createdAt: string;
}

export type ProjectFindingStatus =
  | "open"
  | "confirmed"
  | "dismissed"
  | "dismissed_by_user"
  | "resolved";

export interface ProjectFinding {
  id: string;
  projectId: string;
  projectKnowledgeId: string | null;
  projectKnowledgeVersion: number | null;
  repo: string | null;
  file: string | null;
  lineStart: number | null;
  lineEnd: number | null;
  title: string;
  severity: string;
  category: string;
  evidence: string;
  whyDangerous: string;
  failureMode: string;
  recommendedFix: string;
  whatWouldConfirm: string | null;
  source: string | null;
  endpoint: string | null;
  metadata: Record<string, unknown> | null;
  status: ProjectFindingStatus;
  dismissReason: string | null;
  dismissedBy: string | null;
  testResult: {
    result: "validated" | "not_exploitable" | "not_testable";
    testKnowledgeId: string;
    detail: string;
    evidence: string | null;
    testedAt: string;
  } | null;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppCatPermission {
  id: string;
  appCatId: string;
  stoEmails: string[];
  managerEmails: string[];
  viewerEmails: string[];
  createdAt: string;
  updatedAt: string;
}

// --- Golden dataset evaluation ---

export type EvaluatedStage =
  | "endpoint_inventory"
  | "threat_map"
  | "security_scan"
  | "scan_summary";

export type EvaluationRunStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed";

export interface DatasetSummary {
  id: string;
  description: string;
  capturedAt: string;
  projectName: string;
  repos: { repo: string; commitSha: string }[];
  dynatraceCapturedAt: string;
  dynatraceTimeframe: string;
  expectedCounts: Record<string, number>;
}

export interface ScoredItem {
  key: string;
  label: string;
  detail?: Record<string, unknown>;
}

export interface ScoredMatch {
  expected: ScoredItem;
  actual: ScoredItem;
  rationale?: string;
  fieldAgreement: Record<string, number>;
}

export interface MatchProvenance {
  model: string;
  promptVersion: string;
  degraded: boolean;
  error?: string;
}

export interface StageMetrics {
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
  steps: number;
  modelId: string;
}

export interface StageScore {
  stage: EvaluatedStage;
  status: "completed" | "failed" | "skipped";
  error?: string;
  expectedCount: number;
  actualCount: number;
  precision: number;
  recall: number;
  f1: number;
  matched: ScoredMatch[];
  missed: ScoredItem[];
  extra: ScoredItem[];
  fieldAccuracy: Record<string, number>;
  matching: MatchProvenance;
  metrics: StageMetrics;
}

export interface EvaluationRunTotals {
  meanF1: number;
  totalCost: number;
  durationMs: number;
}

export interface EvaluationRun {
  id: string;
  datasetId: string;
  label: string | null;
  /** The run's overrides per workload task; older runs hold the old routing fields as strings. */
  modelConfig: Record<string, unknown>;
  status: EvaluationRunStatus;
  error: string | null;
  totals: EvaluationRunTotals | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EvaluationStageResult {
  id: string;
  evaluationRunId: string;
  stage: EvaluatedStage;
  score: StageScore;
  actualOutput?: Record<string, unknown> | null;
  createdAt: string;
}

export interface EvaluationRunDetail extends EvaluationRun {
  stageResults: EvaluationStageResult[];
}

export interface StageDelta {
  stage: EvaluatedStage;
  baseF1: number | null;
  targetF1: number | null;
  f1Delta: number | null;
  baseCost: number;
  targetCost: number;
  costDelta: number;
  gained: ScoredItem[];
  lost: ScoredItem[];
}

export interface EvaluationComparison {
  base: EvaluationRun;
  target: EvaluationRun;
  stages: StageDelta[];
}

export interface StartRunParams {
  datasetId: string;
  label?: string;
  stages?: EvaluatedStage[];
  /** Per workload task (e.g. "security_scan", "eval_judge"), the model this run uses. */
  modelOverrides?: Record<string, RouterOverride>;
  concurrency?: number;
}
