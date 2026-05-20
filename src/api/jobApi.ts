import type {
  GithubReviewJob,
  GithubReviewJobActivity,
  JDevApiResponse,
  GetJobsParams,
  CreateJobParams,
  ProcessJobResult,
  CreateJobResult,
  DeleteJobResult,
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

export async function getJobs(
  params: GetJobsParams = {},
): Promise<Partial<GithubReviewJob>[]> {
  const query = new URLSearchParams();
  if (params.id) query.set("id", params.id);
  if (params.status) query.set("status", params.status);
  if (params.githubOwner) query.set("githubOwner", params.githubOwner);
  if (params.githubRepo) query.set("githubRepo", params.githubRepo);
  if (params.githubBranch) query.set("githubBranch", params.githubBranch);
  if (params.dedupKey) query.set("dedupKey", params.dedupKey);
  query.set("includeResults", params.includeResults ? "true" : "false");

  const qs = query.toString();
  const res = await apiFetch<Partial<GithubReviewJob>[]>(`/job?${qs}`);
  return res.data;
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

export async function processPendingJob(): Promise<ProcessJobResult> {
  const res = await apiFetch<ProcessJobResult>("/job/process-pending", {
    method: "POST",
  });
  return res.data;
}

export async function getJobActivities(
  id: string,
): Promise<GithubReviewJobActivity[]> {
  const res = await apiFetch<GithubReviewJobActivity[]>(
    `/job/${encodeURIComponent(id)}/activity`,
  );
  return res.data;
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
