import { useState, useEffect, useCallback } from "react";
import type {
  GithubReviewJob,
  GithubReviewJobActivity,
  GetJobsParams,
  JobStatus,
  PaginationMeta,
} from "../types/job.types";
import {
  getJobs,
  getJobsPaginated,
  processPendingJob,
  deleteJob,
  processJobById,
  getJobActivities,
  pollSqs,
  updateSummaryPages,
  generateFindingsAnalysis,
} from "../api/jobApi";
import Pagination from "../components/Pagination";
import ActivityModal from "../components/ActivityModal";
import CreateJobModal from "../components/CreateJobModal";
import ProcessJobModal from "../components/ProcessJobModal";
import JobDetailModal from "../components/JobDetailModal";
import BatchCreateJobModal from "../components/BatchCreateJobModal";
import FollowUpModal from "../components/FollowUpModal";
import "./JobsPage.css";

interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Partial<GithubReviewJob>[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<GetJobsParams>({});
  const [page, setPage] = useState(1);
  const [pageLimit, setPageLimit] = useState(20);
  const [pageMeta, setPageMeta] = useState<PaginationMeta | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Activity modal state
  const [activityJobId, setActivityJobId] = useState<string | null>(null);
  const [activities, setActivities] = useState<GithubReviewJobActivity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);

  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createFromJob, setCreateFromJob] =
    useState<Partial<GithubReviewJob> | null>(null);
  const [showBatchModal, setShowBatchModal] = useState(false);

  // Job detail modal
  const [detailJob, setDetailJob] = useState<Partial<GithubReviewJob> | null>(
    null,
  );
  const [detailLoading, setDetailLoading] = useState(false);

  // Process modal
  const [processJobId, setProcessJobId] = useState<string | null>(null);
  const [processingJobId, setProcessingJobId] = useState<string | null>(null);

  // Follow-up modal
  const [followUpJobId, setFollowUpJobId] = useState<string | null>(null);

  const [summaryRefreshing, setSummaryRefreshing] = useState(false);
  const [analysisGenerating, setAnalysisGenerating] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);

  const hasActiveFilters = Boolean(
    filters.status ||
      filters.githubOwner ||
      filters.githubRepo ||
      filters.githubBranch,
  );

  const showToast = useCallback(
    (message: string, type: Toast["type"] = "info") => {
      const id = Date.now();
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(
        () => setToasts((prev) => prev.filter((t) => t.id !== id)),
        4000,
      );
    },
    [],
  );

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getJobsPaginated({ ...filters, page, limit: pageLimit });
      setJobs(result.data);
      setPageMeta(result.pagination);
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setLoading(false);
    }
  }, [filters, page, pageLimit, showToast]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Reset to the first page whenever filters change (the result set is different).
  useEffect(() => {
    setPage(1);
  }, [filters]);

  // Close the actions overflow menu on outside click or Escape.
  useEffect(() => {
    if (!showActionsMenu) return;
    const close = () => setShowActionsMenu(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowActionsMenu(false);
    };
    window.addEventListener("click", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [showActionsMenu]);

  const loadActivities = useCallback(
    async (id: string) => {
      setActivitiesLoading(true);
      try {
        const data = await getJobActivities(id);
        setActivities(data);
      } catch (err) {
        showToast((err as Error).message, "error");
      } finally {
        setActivitiesLoading(false);
      }
    },
    [showToast],
  );

  const handleViewActivity = (id: string) => {
    setActivityJobId(id);
    setActivities([]);
    loadActivities(id);
  };

  const handleViewDetail = async (id: string) => {
    setDetailJob(null);
    setDetailLoading(true);
    try {
      const data = await getJobs({ id, includeResults: true });
      setDetailJob(data[0] ?? null);
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleProcessPending = async () => {
    try {
      const result = await processPendingJob();
      showToast(
        result.processed
          ? `Processed job ${result.jobId}`
          : "No pending jobs found",
        result.processed ? "success" : "info",
      );
      if (result.processed) fetchJobs();
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  };

  const handleRefreshSummaryPages = async () => {
    setSummaryRefreshing(true);
    try {
      const result = await updateSummaryPages();
      if (result.updated) {
        showToast("Confluence summary pages refreshed", "success");
      } else {
        showToast(
          `Summary refresh failed: ${result.error ?? "unknown error"}`,
          "error",
        );
      }
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setSummaryRefreshing(false);
    }
  };

  const handleGenerateAnalysis = async () => {
    setAnalysisGenerating(true);
    try {
      const result = await generateFindingsAnalysis();
      if (result.generated) {
        showToast(
          `AI analysis generated (PII: ${result.piiRepoCount ?? 0} repos, Performance: ${result.performanceRepoCount ?? 0} repos)`,
          "success",
        );
      } else {
        showToast(
          `Analysis failed: ${result.error ?? "unknown error"}`,
          "error",
        );
      }
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setAnalysisGenerating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`Delete job ${id.slice(0, 8)}...?`)) return;
    try {
      const result = await deleteJob(id);
      showToast(
        result.deleted ? "Job deleted" : "Job not found",
        result.deleted ? "success" : "error",
      );
      if (result.deleted) fetchJobs();
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  };

  const handleProcessConfirm = async (mode?: "diff" | "full-repo") => {
    if (!processJobId) return;
    setProcessingJobId(processJobId);
    try {
      const result = await processJobById(processJobId, mode);
      showToast(
        result.processed ? `Job processed` : "Job not found or not processable",
        result.processed ? "success" : "error",
      );
      if (result.processed) {
        fetchJobs();
        setProcessJobId(null);
      }
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setProcessingJobId(null);
    }
  };

  const handleCopyId = (id: string) => {
    navigator.clipboard
      .writeText(id)
      .then(() => showToast("Job ID copied", "info"));
  };

  const statusBadgeClass = (status?: string) => {
    const s = status?.toLowerCase().replace("_", "_") ?? "pending";
    return `status-badge status-badge--${s === "in_progress" ? "in_progress" : s}`;
  };

  const formatDate = (dateStr?: string) =>
    dateStr ? new Date(dateStr).toLocaleString() : "—";

  const truncate = (str?: string, len = 8) =>
    str ? `${str.slice(0, len)}…` : "—";

  return (
    <div className="jobs-page">
      <header className="jobs-page__header">
        <h1 className="jobs-page__title">CQL AI Reviewer</h1>
        <span className="jobs-page__subtitle">Job Manager</span>
      </header>

      <div className="jobs-page__content">
        {/* Toolbar */}
        <div className="toolbar">
          <div className="toolbar__filters">
            <div className="filter-group">
              <label>Status</label>
              <select
                className="filter-select"
                value={filters.status ?? ""}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    status: (e.target.value as JobStatus) || undefined,
                  }))
                }
              >
                <option value="">All</option>
                <option value="PENDING">Pending</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="FAILED">Failed</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Owner</label>
              <input
                className="filter-input"
                placeholder="e.g. BMO-Prod"
                value={filters.githubOwner ?? ""}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    githubOwner: e.target.value || undefined,
                  }))
                }
              />
            </div>

            <div className="filter-group">
              <label>Repository</label>
              <input
                className="filter-input"
                placeholder="e.g. my-repo"
                value={filters.githubRepo ?? ""}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    githubRepo: e.target.value || undefined,
                  }))
                }
              />
            </div>

            <div className="filter-group">
              <label>Branch</label>
              <input
                className="filter-input"
                placeholder="e.g. develop"
                value={filters.githubBranch ?? ""}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    githubBranch: e.target.value || undefined,
                  }))
                }
              />
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                className="filter-clear"
                onClick={() => setFilters({})}
              >
                Clear filters
              </button>
            )}
          </div>

          <div className="toolbar__actions">
            <button
              className="btn btn--secondary btn--icon"
              onClick={fetchJobs}
              disabled={loading}
              title="Reload jobs"
              aria-label="Reload jobs"
            >
              {loading ? "Loading…" : "↻ Refresh"}
            </button>

            <div
              className="actions-menu"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="btn btn--secondary"
                onClick={() => setShowActionsMenu((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={showActionsMenu}
              >
                Actions ▾
              </button>
              {showActionsMenu && (
                <div className="actions-menu__dropdown" role="menu">
                  <button
                    className="actions-menu__item"
                    role="menuitem"
                    onClick={() => {
                      setShowActionsMenu(false);
                      handleProcessPending();
                    }}
                  >
                    <span className="actions-menu__label">Process Pending</span>
                    <span className="actions-menu__hint">
                      Run the next queued job
                    </span>
                  </button>
                  <button
                    className="actions-menu__item"
                    role="menuitem"
                    onClick={async () => {
                      setShowActionsMenu(false);
                      const result = await pollSqs();
                      showToast(
                        `SQS: ${result.created} created, ${result.filtered} filtered`,
                        "info",
                      );
                      if (result.created > 0) fetchJobs();
                    }}
                  >
                    <span className="actions-menu__label">Poll SQS</span>
                    <span className="actions-menu__hint">
                      Pull new jobs from the queue
                    </span>
                  </button>
                  <button
                    className="actions-menu__item"
                    role="menuitem"
                    onClick={() => {
                      setShowActionsMenu(false);
                      handleRefreshSummaryPages();
                    }}
                    disabled={summaryRefreshing}
                  >
                    <span className="actions-menu__label">
                      {summaryRefreshing
                        ? "Refreshing Summary…"
                        : "Refresh Summary Pages"}
                    </span>
                    <span className="actions-menu__hint">
                      Rebuild the Confluence rollup pages
                    </span>
                  </button>
                  <button
                    className="actions-menu__item"
                    role="menuitem"
                    onClick={() => {
                      setShowActionsMenu(false);
                      handleGenerateAnalysis();
                    }}
                    disabled={analysisGenerating}
                  >
                    <span className="actions-menu__label">
                      {analysisGenerating
                        ? "Generating Analysis…"
                        : "Generate AI Analysis"}
                    </span>
                    <span className="actions-menu__hint">
                      Costs model usage — analyzes repo summaries
                    </span>
                  </button>
                  <div className="actions-menu__divider" />
                  <button
                    className="actions-menu__item"
                    role="menuitem"
                    onClick={() => {
                      setShowActionsMenu(false);
                      setShowBatchModal(true);
                    }}
                  >
                    <span className="actions-menu__label">Batch Create</span>
                    <span className="actions-menu__hint">
                      Create jobs for many repos
                    </span>
                  </button>
                </div>
              )}
            </div>

            <button
              className="btn btn--primary"
              onClick={() => setShowCreateModal(true)}
            >
              + Create Job
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="jobs-table-wrapper">
          <table className="jobs-table">
            <thead>
              <tr>
                <th>Job ID</th>
                <th>Repository</th>
                <th>Branch</th>
                <th>Type</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="table-state">
                    Loading jobs…
                  </td>
                </tr>
              )}
              {!loading && jobs.length === 0 && (
                <tr>
                  <td colSpan={7} className="table-state">
                    No jobs found
                  </td>
                </tr>
              )}
              {!loading &&
                jobs.map((job) => (
                  <tr key={job.id}>
                    <td>
                      <div className="job-id-cell">
                        <span
                          className="job-id"
                          title={job.id}
                          onClick={() => handleViewDetail(job.id!)}
                        >
                          {truncate(job.id)}
                        </span>
                        <button
                          className="copy-btn"
                          title="Copy full ID"
                          onClick={() => handleCopyId(job.id!)}
                        >
                          ⎘
                        </button>
                      </div>
                    </td>
                    <td>{job.githubRepo ?? "—"}</td>
                    <td>
                      <code className="branch">{job.githubBranch ?? "—"}</code>
                    </td>
                    <td>
                      <span className="job-type-badge">
                        {job.reviewJobType ?? "PII"}
                      </span>
                    </td>
                    <td>
                      <span className={statusBadgeClass(job.status)}>
                        {job.status ?? "—"}
                      </span>
                    </td>
                    <td>{formatDate(job.createdAt)}</td>
                    <td>
                      <div className="actions-cell">
                        <button
                          className="action-btn action-btn--activity"
                          title="View Activity Log"
                          onClick={() => handleViewActivity(job.id!)}
                        >
                          📋
                        </button>
                        <button
                          className="action-btn action-btn--process"
                          title="Process Job"
                          onClick={() => setProcessJobId(job.id!)}
                          disabled={processingJobId === job.id}
                        >
                          {processingJobId === job.id ? "⏳" : "▶"}
                        </button>
                        {job.status === "COMPLETED" && (
                          <button
                            className="action-btn action-btn--followup"
                            title="Follow Up"
                            onClick={() => setFollowUpJobId(job.id!)}
                          >
                            💬
                          </button>
                        )}
                        <button
                          className="action-btn action-btn--clone"
                          title="Create from this job"
                          onClick={() => setCreateFromJob(job)}
                        >
                          ⧉
                        </button>
                        <button
                          className="action-btn action-btn--danger"
                          title="Delete Job"
                          onClick={() => handleDelete(job.id!)}
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <Pagination
          meta={pageMeta}
          disabled={loading}
          onPageChange={setPage}
          onLimitChange={(limit) => {
            setPageLimit(limit);
            setPage(1);
          }}
        />
      </div>

      {/* Modals */}
      {(detailJob !== null || detailLoading) && (
        <JobDetailModal
          job={detailJob}
          loading={detailLoading}
          onClose={() => {
            setDetailJob(null);
            setDetailLoading(false);
          }}
        />
      )}

      {showBatchModal && (
        <BatchCreateJobModal
          onClose={() => setShowBatchModal(false)}
          onDone={(created, failed) => {
            showToast(
              `Batch done: ${created} created, ${failed} failed`,
              failed === 0 ? "success" : "info",
            );
            fetchJobs();
          }}
        />
      )}

      {activityJobId && (
        <ActivityModal
          jobId={activityJobId}
          activities={activities}
          loading={activitiesLoading}
          onClose={() => setActivityJobId(null)}
          onRefresh={() => loadActivities(activityJobId)}
        />
      )}

      {(showCreateModal || createFromJob) && (
        <CreateJobModal
          onClose={() => {
            setShowCreateModal(false);
            setCreateFromJob(null);
          }}
          onCreated={(jobId) => {
            setShowCreateModal(false);
            setCreateFromJob(null);
            fetchJobs();
            showToast(
              `Job created${jobId ? `: ${jobId.slice(0, 8)}…` : ""}`,
              "success",
            );
          }}
          onError={(msg) => showToast(msg, "error")}
          initialData={
            createFromJob
              ? {
                  githubOwner: createFromJob.githubOwner,
                  githubRepo: createFromJob.githubRepo,
                  githubBranch: createFromJob.githubBranch,
                  reviewJobType: createFromJob.reviewJobType,
                  dependentRepos: (createFromJob.requestPayload as any)
                    ?.dependentRepos,
                }
              : undefined
          }
        />
      )}

      {processJobId && (
        <ProcessJobModal
          jobId={processJobId}
          onClose={() => setProcessJobId(null)}
          onConfirm={handleProcessConfirm}
          processing={processingJobId === processJobId}
        />
      )}

      {followUpJobId && (
        <FollowUpModal
          jobId={followUpJobId}
          onClose={() => setFollowUpJobId(null)}
          onDone={(newFindings) => {
            setFollowUpJobId(null);
            fetchJobs();
            showToast(
              `Follow-up completed: ${newFindings} new finding${newFindings !== 1 ? "s" : ""}`,
              "success",
            );
          }}
          onError={(msg) => {
            showToast(msg, "error");
          }}
        />
      )}

      {/* Toasts */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.type}`}>
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
