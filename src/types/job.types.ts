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
