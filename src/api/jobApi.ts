import type {
  GithubReviewJob,
  GithubReviewJobActivity,
  JDevApiResponse,
  GetJobsParams,
  CreateJobParams,
  ProcessJobResult,
  CreateJobResult,
  DeleteJobResult,
  FollowUpResult,
  ReviewJobType,
  ReviewJobTypeVersion,
  IssueJobRow,
  IssueDetailRow,
  MdJobRow,
  MdDetailRow,
  MdLabelRow,
  MdAudienceRow,
  RepoConfig,
  Project,
  ProjectRepo,
  ProjectRun,
  AppCatPermission,
  Paginated,
  ListParams,
} from "../types/job.types";

// Use a relative path so requests go through the Vite dev proxy (avoids SSL cert issues).
// In production, set VITE_API_BASE_URL and remove the '/api' fallback as needed.
const BASE_URL = "/api";
const API_KEY = import.meta.env.VITE_API_KEY as string;

function getHeaders(): HeadersInit {
  return {
    "x-internal-api-key": API_KEY,
    "Content-Type": "application/json",
  };
}

async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<JDevApiResponse<T>> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      ...getHeaders(),
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${text}`);
  }

  return res.json() as Promise<JDevApiResponse<T>>;
}

// Append optional pagination params to a URLSearchParams instance.
function applyListParams(query: URLSearchParams, params?: ListParams): void {
  if (!params) return;
  if (params.page !== undefined) query.set("page", String(params.page));
  if (params.limit !== undefined) query.set("limit", String(params.limit));
  if (params.orderBy) query.set("orderBy", params.orderBy);
  if (params.order) query.set("order", params.order);
}

// Returns the full paginated envelope. `getJobs` below unwraps to the array for
// callers that don't care about pagination.
export async function getJobsPaginated(
  params: GetJobsParams & ListParams = {},
): Promise<Paginated<Partial<GithubReviewJob>>> {
  const query = new URLSearchParams();
  if (params.id) query.set("id", params.id);
  if (params.status) query.set("status", params.status);
  if (params.githubOwner) query.set("githubOwner", params.githubOwner);
  if (params.githubRepo) query.set("githubRepo", params.githubRepo);
  if (params.githubBranch) query.set("githubBranch", params.githubBranch);
  if (params.dedupKey) query.set("dedupKey", params.dedupKey);
  if (params.includeResults) query.set("includeResults", "true");
  if (params.includeMetrics) query.set("includeMetrics", "true");
  applyListParams(query, params);

  const qs = query.toString();
  const res = await apiFetch<Paginated<Partial<GithubReviewJob>>>(`/job?${qs}`);
  return res.data;
}

export async function getJobs(
  params: GetJobsParams & ListParams = {},
): Promise<Partial<GithubReviewJob>[]> {
  const result = await getJobsPaginated(params);
  return result.data;
}

export async function createJob(
  params: CreateJobParams,
): Promise<CreateJobResult> {
  const res = await apiFetch<CreateJobResult>("/job", {
    method: "POST",
    body: JSON.stringify(params),
  });
  return res.data;
}

/**
 * Create a review job from a JFrog Artifactory zip and start it immediately.
 */
export async function createJobFromZip(params: {
  githubOwner: string;
  githubRepo: string;
  githubBranch: string;
  reviewJobType?: string;
  commitHash?: string;
  jfrogUrl: string;
}): Promise<CreateJobResult> {
  const res = await apiFetch<CreateJobResult>("/job/from-zip", {
    method: "POST",
    body: JSON.stringify(params),
  });
  return res.data;
}

export async function processPendingJob(): Promise<ProcessJobResult> {
  const res = await apiFetch<ProcessJobResult>("/job/process-pending", {
    method: "POST",
  });
  return res.data;
}

export async function getJobActivities(
  id: string,
  params?: ListParams,
): Promise<GithubReviewJobActivity[]> {
  const query = new URLSearchParams();
  applyListParams(query, params);
  const res = await apiFetch<Paginated<GithubReviewJobActivity>>(
    `/job/${encodeURIComponent(id)}/activity?${query.toString()}`,
  );
  return res.data.data;
}

export async function processJobById(
  id: string,
  mode?: "diff" | "full-repo",
): Promise<ProcessJobResult> {
  const res = await apiFetch<ProcessJobResult>(
    `/job/${encodeURIComponent(id)}/process`,
    {
      method: "POST",
      body: JSON.stringify(mode ? { mode } : {}),
    },
  );
  return res.data;
}

export async function deleteJob(id: string): Promise<DeleteJobResult> {
  const res = await apiFetch<DeleteJobResult>(
    `/job/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
    },
  );
  return res.data;
}

export async function followUpJob(
  id: string,
  prompt: string,
): Promise<FollowUpResult> {
  const res = await apiFetch<FollowUpResult>(
    `/job/${encodeURIComponent(id)}/follow-up`,
    {
      method: "POST",
      body: JSON.stringify({ prompt }),
    },
  );
  return res.data;
}

// --- Job Type API ---

export async function getJobTypes(params?: ListParams): Promise<ReviewJobType[]> {
  const query = new URLSearchParams();
  applyListParams(query, params);
  const res = await apiFetch<Paginated<ReviewJobType>>(`/job-type?${query.toString()}`);
  return res.data.data;
}

export async function getJobType(id: string): Promise<ReviewJobType> {
  const res = await apiFetch<ReviewJobType>(
    `/job-type/${encodeURIComponent(id)}`,
  );
  return res.data;
}

export async function createJobType(
  data: Omit<ReviewJobType, "createdAt" | "updatedAt">,
): Promise<ReviewJobType> {
  const res = await apiFetch<ReviewJobType>("/job-type", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function updateJobType(
  id: string,
  data: Partial<Omit<ReviewJobType, "id" | "createdAt" | "updatedAt">>,
): Promise<ReviewJobType> {
  const res = await apiFetch<ReviewJobType>(
    `/job-type/${encodeURIComponent(id)}`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    },
  );
  return res.data;
}

export async function deleteJobType(id: string): Promise<{ deleted: boolean }> {
  const res = await apiFetch<{ deleted: boolean }>(
    `/job-type/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
    },
  );
  return res.data;
}

export async function getJobTypeVersions(
  id: string,
  params?: ListParams,
): Promise<ReviewJobTypeVersion[]> {
  const query = new URLSearchParams();
  applyListParams(query, params);
  const res = await apiFetch<Paginated<ReviewJobTypeVersion>>(
    `/job-type/${encodeURIComponent(id)}/versions?${query.toString()}`,
  );
  return res.data.data;
}

export async function getJobTypeVersion(
  id: string,
  versionId: string,
): Promise<ReviewJobTypeVersion> {
  const res = await apiFetch<ReviewJobTypeVersion>(
    `/job-type/${encodeURIComponent(id)}/versions/${encodeURIComponent(versionId)}`,
  );
  return res.data;
}

export async function rollbackJobType(
  id: string,
  versionId: string,
): Promise<ReviewJobType> {
  const res = await apiFetch<ReviewJobType>(
    `/job-type/${encodeURIComponent(id)}/rollback`,
    {
      method: "POST",
      body: JSON.stringify({ versionId }),
    },
  );
  return res.data;
}

// --- Settings API ---

export interface SettingResponse {
  id: string;
  name: string;
  value: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export async function getSetting(name: string): Promise<SettingResponse> {
  const res = await apiFetch<SettingResponse>(
    `/setting/${encodeURIComponent(name)}`,
  );
  return res.data;
}

export async function updateSetting(
  name: string,
  value: Record<string, unknown>,
): Promise<SettingResponse> {
  const res = await apiFetch<SettingResponse>(
    `/setting/${encodeURIComponent(name)}`,
    {
      method: "PUT",
      body: JSON.stringify({ value }),
    },
  );
  return res.data;
}

// --- Report API ---

export type ReportView =
  | "issue-job"
  | "issue-detail"
  | "md-job"
  | "md-detail"
  | "md-label"
  | "md-audience";

// Generic paginated fetch for any report view — returns the full envelope so the
// caller can render page controls. The per-view helpers below unwrap to arrays.
export async function getReportViewPaginated<T>(
  view: ReportView,
  params?: ListParams,
): Promise<Paginated<T>> {
  const query = new URLSearchParams();
  applyListParams(query, params);
  const res = await apiFetch<Paginated<T>>(`/report/${view}?${query.toString()}`);
  return res.data;
}

export async function getIssueJobView(params?: ListParams): Promise<IssueJobRow[]> {
  const query = new URLSearchParams();
  applyListParams(query, params);
  const res = await apiFetch<Paginated<IssueJobRow>>(`/report/issue-job?${query.toString()}`);
  return res.data.data;
}

export async function getIssueDetailView(params?: ListParams): Promise<IssueDetailRow[]> {
  const query = new URLSearchParams();
  applyListParams(query, params);
  const res = await apiFetch<Paginated<IssueDetailRow>>(`/report/issue-detail?${query.toString()}`);
  return res.data.data;
}

export async function getMdJobView(params?: ListParams): Promise<MdJobRow[]> {
  const query = new URLSearchParams();
  applyListParams(query, params);
  const res = await apiFetch<Paginated<MdJobRow>>(`/report/md-job?${query.toString()}`);
  return res.data.data;
}

export async function getMdDetailView(params?: ListParams): Promise<MdDetailRow[]> {
  const query = new URLSearchParams();
  applyListParams(query, params);
  const res = await apiFetch<Paginated<MdDetailRow>>(`/report/md-detail?${query.toString()}`);
  return res.data.data;
}

export async function getMdLabelView(params?: ListParams): Promise<MdLabelRow[]> {
  const query = new URLSearchParams();
  applyListParams(query, params);
  const res = await apiFetch<Paginated<MdLabelRow>>(`/report/md-label?${query.toString()}`);
  return res.data.data;
}

export async function getMdAudienceView(params?: ListParams): Promise<MdAudienceRow[]> {
  const query = new URLSearchParams();
  applyListParams(query, params);
  const res = await apiFetch<Paginated<MdAudienceRow>>(`/report/md-audience?${query.toString()}`);
  return res.data.data;
}

// --- Repo Config API ---

export async function getRepoConfigs(params?: ListParams): Promise<RepoConfig[]> {
  const query = new URLSearchParams();
  applyListParams(query, params);
  const res = await apiFetch<Paginated<RepoConfig>>(`/repo-config?${query.toString()}`);
  return res.data.data;
}

export async function createRepoConfig(
  data: Partial<RepoConfig>,
): Promise<RepoConfig> {
  const res = await apiFetch<RepoConfig>("/repo-config", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function updateRepoConfig(
  id: string,
  data: Partial<RepoConfig>,
): Promise<RepoConfig> {
  const res = await apiFetch<RepoConfig>(
    `/repo-config/${encodeURIComponent(id)}`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    },
  );
  return res.data;
}

export async function deleteRepoConfig(
  id: string,
): Promise<{ deleted: boolean }> {
  const res = await apiFetch<{ deleted: boolean }>(
    `/repo-config/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
    },
  );
  return res.data;
}

export async function batchAddEmailsToRepoConfigs(params: {
  repoPatterns: string[];
  emails: string[];
}): Promise<{
  matched: Array<{ id: string; githubOwner: string; githubRepo: string }>;
  permissionsRefreshed: number;
}> {
  const res = await apiFetch<{
    matched: Array<{ id: string; githubOwner: string; githubRepo: string }>;
    permissionsRefreshed: number;
  }>("/repo-config/batch-add-emails", {
    method: "POST",
    body: JSON.stringify(params),
  });
  return res.data;
}

// --- Ingestion API ---

export type SourceRepo = {
  githubOwner: string;
  githubRepo: string;
  githubBranch: string;
  payload?: Record<string, unknown>;
};

export interface IngestResult {
  created: number;
  skipped: number;
  jobs: { repo: string; branch: string; jobType: string; jobId: string }[];
  skippedRepos: {
    repo: string;
    branch: string;
    jobType: string;
    reason: string;
  }[];
}

export async function getSourceRepos(): Promise<SourceRepo[]> {
  const res = await apiFetch<SourceRepo[]>("/job/source-repos");
  return res.data;
}

/**
 * Ingest repos and create jobs.
 * - Pass no `repos` (or undefined) to ingest directly from the external source query (no override).
 * - Pass an explicit `repos` array to use those repos instead of the source query (override).
 */
export async function ingestFromSource(
  repos?: SourceRepo[],
): Promise<IngestResult> {
  const res = await apiFetch<IngestResult>("/job/ingest-from-source", {
    method: "POST",
    body: JSON.stringify(repos && repos.length > 0 ? { repos } : {}),
  });
  return res.data;
}

export async function pollSqs(): Promise<{
  processed: number;
  created: number;
  filtered: number;
}> {
  const res = await apiFetch<{ processed: number; created: number; filtered: number }>(
    "/job/poll-sqs",
    { method: "POST" },
  );
  return res.data;
}

export async function publishJob(
  id: string,
): Promise<{ published: boolean; link?: string; error?: string }> {
  const res = await apiFetch<{
    published: boolean;
    link?: string;
    error?: string;
  }>(`/job/${encodeURIComponent(id)}/publish`, { method: "POST" });
  return res.data;
}

export async function updateSummaryPages(): Promise<{
  updated: boolean;
  error?: string;
}> {
  const res = await apiFetch<{ updated: boolean; error?: string }>(
    "/job/update-summary-pages",
    { method: "POST" },
  );
  return res.data;
}

export async function refreshPagePermissions(
  repos?: Array<{ githubOwner: string; githubRepo: string }>,
): Promise<{
  refreshed: Array<{ repo: string; pageId: string }>;
  skipped: Array<{ repo: string; reason: string }>;
}> {
  const res = await apiFetch<{
    refreshed: Array<{ repo: string; pageId: string }>;
    skipped: Array<{ repo: string; reason: string }>;
  }>("/job/refresh-permissions", {
    method: "POST",
    body: JSON.stringify(repos && repos.length > 0 ? { repos } : {}),
  });
  return res.data;
}

export async function generateFindingsAnalysis(): Promise<{
  generated: boolean;
  piiRepoCount?: number;
  performanceRepoCount?: number;
  error?: string;
}> {
  const res = await apiFetch<{
    generated: boolean;
    piiRepoCount?: number;
    performanceRepoCount?: number;
    error?: string;
  }>("/job/generate-findings-analysis", { method: "POST" });
  return res.data;
}

// --- Threat-modeling projects (AI vuln pipeline) ---

export async function getProjects(params?: ListParams): Promise<Project[]> {
  const query = new URLSearchParams();
  applyListParams(query, params);
  const res = await apiFetch<Paginated<Project>>(`/project?${query.toString()}`);
  return res.data.data;
}

export async function getProject(id: string): Promise<Project> {
  const res = await apiFetch<Project>(`/project/${encodeURIComponent(id)}`);
  return res.data;
}

export async function createProject(data: {
  name: string;
  description?: string | null;
}): Promise<Project> {
  const res = await apiFetch<Project>("/project", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function updateProject(
  id: string,
  data: Partial<Pick<Project, "name" | "description" | "enabled">>,
): Promise<Project> {
  const res = await apiFetch<Project>(`/project/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function deleteProject(id: string): Promise<{ deleted: boolean }> {
  const res = await apiFetch<{ deleted: boolean }>(
    `/project/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
  return res.data;
}

export async function addProjectRepo(
  projectId: string,
  data: Partial<ProjectRepo>,
): Promise<ProjectRepo> {
  const res = await apiFetch<ProjectRepo>(
    `/project/${encodeURIComponent(projectId)}/repos`,
    { method: "POST", body: JSON.stringify(data) },
  );
  return res.data;
}

export async function removeProjectRepo(
  projectId: string,
  repoId: string,
): Promise<{ deleted: boolean }> {
  const res = await apiFetch<{ deleted: boolean }>(
    `/project/${encodeURIComponent(projectId)}/repos/${encodeURIComponent(repoId)}`,
    { method: "DELETE" },
  );
  return res.data;
}

export async function createProjectRun(
  projectId: string,
  stages?: string[],
): Promise<ProjectRun> {
  const res = await apiFetch<ProjectRun>(
    `/project/${encodeURIComponent(projectId)}/run`,
    { method: "POST", body: JSON.stringify(stages ? { stages } : {}) },
  );
  return res.data;
}

export async function processProjectRun(
  runId: string,
): Promise<{ processed: boolean; runId?: string }> {
  const res = await apiFetch<{ processed: boolean; runId?: string }>(
    `/project/run/${encodeURIComponent(runId)}/process`,
    { method: "POST" },
  );
  return res.data;
}

export async function getProjectRuns(
  projectId: string,
  params?: ListParams,
): Promise<ProjectRun[]> {
  const query = new URLSearchParams();
  applyListParams(query, params);
  const res = await apiFetch<Paginated<ProjectRun>>(
    `/project/${encodeURIComponent(projectId)}/runs?${query.toString()}`,
  );
  return res.data.data;
}

// --- App Catalog Permissions ---

export async function getAppCatPermissions(): Promise<AppCatPermission[]> {
  const res = await apiFetch<AppCatPermission[]>("/app-cat");
  return res.data;
}

export async function getAppCatPermission(
  appCatId: string,
): Promise<AppCatPermission> {
  const res = await apiFetch<AppCatPermission>(
    `/app-cat/${encodeURIComponent(appCatId)}`,
  );
  return res.data;
}

export async function upsertAppCatPermission(params: {
  appCatId: string;
  stoEmails?: string[];
  managerEmails?: string[];
  viewerEmails?: string[];
}): Promise<AppCatPermission> {
  const res = await apiFetch<AppCatPermission>("/app-cat", {
    method: "PUT",
    body: JSON.stringify(params),
  });
  return res.data;
}

export async function deleteAppCatPermission(
  appCatId: string,
): Promise<void> {
  await apiFetch<{ deleted: boolean }>(
    `/app-cat/${encodeURIComponent(appCatId)}`,
    { method: "DELETE" },
  );
}

// --- Dev Tools ---

export async function testModel(params: {
  prompt: string;
  modelId: string;
}): Promise<{ modelId: string; prompt: string; response: string }> {
  const res = await apiFetch<{
    modelId: string;
    prompt: string;
    response: string;
  }>("/dev/test-model", {
    method: "POST",
    body: JSON.stringify(params),
  });
  return res.data;
}
