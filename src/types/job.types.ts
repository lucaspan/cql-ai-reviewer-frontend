export type JobStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

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
}

export interface CreateJobParams {
  githubOwner: string;
  githubRepo: string;
  githubBranch: string;
  dedupKey?: string;
  reviewJobType?: string;
  dependentRepos?: DependentRepo[];
  dependencyContext?: string;
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
  created_at: string;
}

export interface IssueDetailRow {
  job_id: string;
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
  created_at: string;
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
  created_at: string;
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
}

export interface MdLabelRow {
  label: string;
  total_count: number;
}

export interface MdAudienceRow {
  audience: string;
  total_count: number;
}
