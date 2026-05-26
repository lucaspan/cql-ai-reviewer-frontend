import { useState, useEffect } from "react";
import { getJobs } from "../api/jobApi";
import type { GithubReviewJob, ReviewMetrics } from "../types/job.types";
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const data = await getJobs({ status: "COMPLETED", includeMetrics: true });
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
              <th>Model</th>
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
                <td colSpan={9} className="metrics-empty">
                  No metrics data available
                </td>
              </tr>
            )}
            {jobsWithMetrics.map((job) => (
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
                <td>
                  <span className="metrics-model">
                    {job.metrics?.model?.split(".").pop()?.split(":")[0] ?? "—"}
                  </span>
                </td>
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
    </div>
  );
}
