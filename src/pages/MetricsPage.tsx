import { useState, useEffect } from "react";
import { getJobs, getCommitReviewJobMetrics } from "../api/jobApi";
import type {
  GithubReviewJob,
  ReviewMetrics,
  PaginationMeta,
} from "../types/job.types";
import Pagination from "../components/Pagination";
import "./MetricsPage.css";

interface JobWithMetrics {
  id: string;
  githubRepo: string;
  githubBranch: string;
  reviewJobType: string;
  status: string;
  createdAt: string;
  metrics: ReviewMetrics | null;
}

export default function MetricsPage() {
  const [jobs, setJobs] = useState<JobWithMetrics[]>([]);
  const [commitJobs, setCommitJobs] = useState<JobWithMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  // Client-side pagination of the table only; summary cards stay aggregated over all rows.
  const [page, setPage] = useState(1);
  const [pageLimit, setPageLimit] = useState(20);
  const [commitPage, setCommitPage] = useState(1);

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const [data, commitData] = await Promise.all([
        getJobs({ status: "COMPLETED", includeMetrics: true }),
        getCommitReviewJobMetrics()
      ]);
      const mapped: JobWithMetrics[] = data.map((j: Partial<GithubReviewJob>) => ({
        id: j.id!,
        githubRepo: j.githubRepo ?? "",
        githubBranch: j.githubBranch ?? "",
        reviewJobType: j.reviewJobType ?? "PII",
        status: j.status ?? "",
        createdAt: j.createdAt ?? "",
        metrics: (j.results as any)?.metrics ?? null,
      }));
      setJobs(mapped);

      const commitMapped: JobWithMetrics[] = (commitData as any[]).map((j: any) => ({
        id: j.id,
        githubRepo: j.githubRepo ?? "",
        githubBranch: "",
        reviewJobType: "COMMIT_REVIEW",
        status: j.status ?? "",
        createdAt: j.createdAt ?? "",
        metrics: j.results?.metrics ?? null,
      }));
      setCommitJobs(commitMapped);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const jobsWithMetrics = jobs.filter((j) => j.metrics);
  const totalCost = jobsWithMetrics.reduce(
    (sum, j) => sum + (j.metrics?.totalCost ?? 0),
    0,
  );
  const totalTokens = jobsWithMetrics.reduce(
    (sum, j) => sum + (j.metrics?.totalTokens ?? 0),
    0,
  );
  const totalJobs = jobsWithMetrics.length;

  const now = Date.now();
  const cost24h = jobsWithMetrics
    .filter((j) => now - new Date(j.createdAt).getTime() < 24 * 60 * 60 * 1000)
    .reduce((sum, j) => sum + (j.metrics?.totalCost ?? 0), 0);
  const costMonth = jobsWithMetrics
    .filter((j) => now - new Date(j.createdAt).getTime() < 30 * 24 * 60 * 60 * 1000)
    .reduce((sum, j) => sum + (j.metrics?.totalCost ?? 0), 0);

  // Page the table client-side over the full in-memory list.
  const totalPages = Math.max(1, Math.ceil(jobsWithMetrics.length / pageLimit));
  const safePage = Math.min(page, totalPages);
  const pagedJobs = jobsWithMetrics.slice(
    (safePage - 1) * pageLimit,
    safePage * pageLimit,
  );
  const pageMeta: PaginationMeta = {
    page: safePage,
    limit: pageLimit,
    total: jobsWithMetrics.length,
    totalPages,
    hasNext: safePage < totalPages,
    hasPrevious: safePage > 1,
  };

  const formatCost = (cost: number) => `$${cost.toFixed(4)}`;
  const formatTokens = (tokens: number) =>
    tokens >= 1_000_000
      ? `${(tokens / 1_000_000).toFixed(2)}M`
      : tokens >= 1_000
        ? `${(tokens / 1_000).toFixed(1)}K`
        : String(tokens);
  const formatDate = (d: string) =>
    d ? new Date(d).toLocaleDateString() : "—";

  if (loading) {
    return <div className="metrics-state">Loading metrics...</div>;
  }

  return (
    <div className="metrics-content">
      <div className="metrics-summary">
        <div className="metrics-card">
          <span className="metrics-card__value">{totalJobs}</span>
          <span className="metrics-card__label">Completed Jobs</span>
        </div>
        <div className="metrics-card">
          <span className="metrics-card__value">{formatTokens(totalTokens)}</span>
          <span className="metrics-card__label">Total Tokens</span>
        </div>
        <div className="metrics-card">
          <span className="metrics-card__value">{formatCost(cost24h)}</span>
          <span className="metrics-card__label">Cost (24h)</span>
        </div>
        <div className="metrics-card">
          <span className="metrics-card__value">{formatCost(costMonth)}</span>
          <span className="metrics-card__label">Cost (30d)</span>
        </div>
        <div className="metrics-card">
          <span className="metrics-card__value">{formatCost(totalCost)}</span>
          <span className="metrics-card__label">Total Cost</span>
        </div>
        <div className="metrics-card">
          <span className="metrics-card__value">
            {totalJobs > 0 ? formatCost(totalCost / totalJobs) : "—"}
          </span>
          <span className="metrics-card__label">Avg Cost / Job</span>
        </div>
      </div>

      <div className="metrics-table-wrapper">
        <table className="metrics-table">
          <thead>
            <tr>
              <th>Repository</th>
              <th>Type</th>
              <th>Date</th>
              <th>Input</th>
              <th>Output</th>
              <th>Cache Read</th>
              <th>Cache Write</th>
              <th>Cost</th>
            </tr>
          </thead>
          <tbody>
            {jobsWithMetrics.length === 0 && (
              <tr>
                <td colSpan={8} className="metrics-empty">
                  No metrics data available
                </td>
              </tr>
            )}
            {pagedJobs.map((job) => (
              <tr key={job.id}>
                <td>
                  <span className="metrics-repo" title={job.githubRepo}>
                    {job.githubRepo}
                  </span>
                </td>
                <td>
                  <span className="metrics-type-badge">{job.reviewJobType}</span>
                </td>
                <td>{formatDate(job.createdAt)}</td>
                <td>{formatTokens(job.metrics?.inputTokens ?? 0)}</td>
                <td>{formatTokens(job.metrics?.outputTokens ?? 0)}</td>
                <td>{formatTokens(job.metrics?.cacheReadTokens ?? 0)}</td>
                <td>{formatTokens(job.metrics?.cacheWriteTokens ?? 0)}</td>
                <td className="metrics-cost">{formatCost(job.metrics?.totalCost ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {jobsWithMetrics.length > 0 && (
        <Pagination
          meta={pageMeta}
          onPageChange={setPage}
          onLimitChange={(limit) => {
            setPageLimit(limit);
            setPage(1);
          }}
        />
      )}

      {/* Commit Review Metrics */}
      {(() => {
        const crJobs = commitJobs.filter((j) => j.metrics);
        if (crJobs.length === 0) return null;
        const crTotalCost = crJobs.reduce((sum, j) => sum + (j.metrics?.totalCost ?? 0), 0);
        const crTotalTokens = crJobs.reduce((sum, j) => sum + (j.metrics?.totalTokens ?? 0), 0);
        const crTotalInputTokens = crJobs.reduce((sum, j) => sum + ((j.metrics as any)?.totalInputTokens ?? j.metrics?.inputTokens ?? 0), 0);
        const crTotalOutputTokens = crJobs.reduce((sum, j) => sum + (j.metrics?.outputTokens ?? 0), 0);
        const crTotalPages = Math.max(1, Math.ceil(crJobs.length / pageLimit));
        const crSafePage = Math.min(commitPage, crTotalPages);
        const crPagedJobs = crJobs.slice((crSafePage - 1) * pageLimit, crSafePage * pageLimit);
        const crPageMeta: PaginationMeta = { page: crSafePage, limit: pageLimit, total: crJobs.length, totalPages: crTotalPages, hasNext: crSafePage < crTotalPages, hasPrevious: crSafePage > 1 };

        return (
          <>
            <h3 style={{ marginTop: 32, marginBottom: 12, fontSize: 16, fontWeight: 700 }}>Commit Review Jobs</h3>
            <div className="metrics-summary">
              <div className="metrics-card">
                <span className="metrics-card__value">{crJobs.length}</span>
                <span className="metrics-card__label">Completed</span>
              </div>
              <div className="metrics-card">
                <span className="metrics-card__value">{formatTokens(crTotalInputTokens)}</span>
                <span className="metrics-card__label">Input Tokens</span>
              </div>
              <div className="metrics-card">
                <span className="metrics-card__value">{formatTokens(crTotalOutputTokens)}</span>
                <span className="metrics-card__label">Output Tokens</span>
              </div>
              <div className="metrics-card">
                <span className="metrics-card__value">{formatTokens(crTotalTokens)}</span>
                <span className="metrics-card__label">Total Tokens</span>
              </div>
              <div className="metrics-card">
                <span className="metrics-card__value">{formatCost(crTotalCost)}</span>
                <span className="metrics-card__label">Total Cost</span>
              </div>
              <div className="metrics-card">
                <span className="metrics-card__value">{crJobs.length > 0 ? formatCost(crTotalCost / crJobs.length) : "—"}</span>
                <span className="metrics-card__label">Avg Cost / Job</span>
              </div>
            </div>

            <div className="metrics-table-wrapper">
              <table className="metrics-table">
                <thead>
                  <tr>
                    <th>Repository</th>
                    <th>Date</th>
                    <th>Input</th>
                    <th>Output</th>
                    <th>Cache Read</th>
                    <th>Cache Write</th>
                    <th>Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {crPagedJobs.map((j) => (
                    <tr key={j.id}>
                      <td>{j.githubRepo}</td>
                      <td>{formatDate(j.createdAt)}</td>
                      <td>{formatTokens((j.metrics as any)?.totalInputTokens ?? j.metrics?.inputTokens ?? 0)}</td>
                      <td>{formatTokens(j.metrics?.outputTokens ?? 0)}</td>
                      <td>{formatTokens((j.metrics as any)?.cacheReadTokens ?? 0)}</td>
                      <td>{formatTokens((j.metrics as any)?.cacheWriteTokens ?? 0)}</td>
                      <td>{formatCost(j.metrics?.totalCost ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {crJobs.length > pageLimit && (
              <Pagination
                meta={crPageMeta}
                onPageChange={setCommitPage}
                onLimitChange={() => {}}
              />
            )}
          </>
        );
      })()}
    </div>
  );
}
