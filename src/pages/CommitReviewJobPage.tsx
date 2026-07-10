import { useState, useEffect, useCallback } from "react";
import {
  getCommitReviewJobs,
  getCommitReviewJob,
  fetchLatestCommits,
  createCommitReviewJob,
  processCommitReviewJob,
  processPendingCommitReviewJob,
  retryCommitReviewJob,
  deleteCommitReviewJob,
  getCommitReviewJobActivities
} from "../api/jobApi";
import Pagination from "../components/Pagination";
import ActivityModal from "../components/ActivityModal";
import "../components/Modal.css";
import "./JobsPage.css";
import "./CommitReviewJobPage.css";

interface CommitReviewJobRow {
  id: string;
  githubOwner: string;
  githubRepo: string;
  githubCommit: string;
  status: string;
  reviewJobType: string | null;
  requestPayload: { author?: string; commitDate?: string; linesAdded?: number; linesDeleted?: number; filesChanged?: number };
  results: any;
  error: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface DimensionRow {
  id: string;
  dimension: string;
  type: "score" | "flag";
  score: number | null;
  flagged: boolean | null;
  reason: string | null;
}

interface SourceCommit {
  component: string;
  sha: string;
  commitDate: string;
  author: string;
  linesAdded: number;
  linesDeleted: number;
  filesChanged: number;
}

export default function CommitReviewJobPage() {
  const [jobs, setJobs] = useState<CommitReviewJobRow[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [pageLimit, setPageLimit] = useState(20);
  const [loading, setLoading] = useState(true);

  const [filterRepo, setFilterRepo] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Manual create
  const [showCreate, setShowCreate] = useState(false);
  const [createOwner, setCreateOwner] = useState("BMO-Prod");
  const [createRepo, setCreateRepo] = useState("");
  const [createCommit, setCreateCommit] = useState("");
  const [creatingManual, setCreatingManual] = useState(false);

  // Fetch latest commits from source
  const [showFetch, setShowFetch] = useState(false);
  const [sourceCommits, setSourceCommits] = useState<SourceCommit[]>([]);
  const [fetching, setFetching] = useState(false);
  const [creating, setCreating] = useState(false);

  // Detail modal
  const [detailJob, setDetailJob] = useState<CommitReviewJobRow | null>(null);
  const [detailDimensions, setDetailDimensions] = useState<DimensionRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Activity modal (separate from detail)
  const [activityJobId, setActivityJobId] = useState<string | null>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);

  // Processing
  const [processingJobId, setProcessingJobId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getCommitReviewJobs({
        page,
        limit: pageLimit,
        githubRepo: filterRepo || undefined,
        status: filterStatus || undefined
      });
      setJobs(result.data);
      setPagination(result.pagination);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [page, pageLimit, filterRepo, filterStatus]);

  useEffect(() => { load(); }, [load]);

  const handleManualCreate = async () => {
    if (!createRepo.trim() || !createCommit.trim()) return;
    setCreatingManual(true);
    try {
      await createCommitReviewJob({
        githubOwner: createOwner.trim(),
        githubRepo: createRepo.trim(),
        githubCommit: createCommit.trim()
      });
      setCreateRepo("");
      setCreateCommit("");
      setShowCreate(false);
      load();
    } catch {
      // silent — likely duplicate
    } finally {
      setCreatingManual(false);
    }
  };

  const handleFetchLatest = async () => {
    setFetching(true);
    try {
      const data = await fetchLatestCommits(100);
      setSourceCommits(data);
      setShowFetch(true);
    } catch {
      // silent
    } finally {
      setFetching(false);
    }
  };

  const handleCreateJob = async (commit: SourceCommit) => {
    setCreating(true);
    try {
      await createCommitReviewJob({
        githubOwner: "BMO-Prod",
        githubRepo: commit.component,
        githubCommit: commit.sha,
        requestPayload: {
          author: commit.author,
          commitDate: commit.commitDate,
          linesAdded: commit.linesAdded,
          linesDeleted: commit.linesDeleted,
          filesChanged: commit.filesChanged
        }
      });
      setSourceCommits((prev) => prev.filter((c) => c.sha !== commit.sha));
      load();
    } catch {
      // skip duplicates
    } finally {
      setCreating(false);
    }
  };

  const handleCreateAll = async () => {
    setCreating(true);
    try {
      for (const commit of sourceCommits) {
        try {
          await createCommitReviewJob({
            githubOwner: "BMO-Prod",
            githubRepo: commit.component,
            githubCommit: commit.sha,
            requestPayload: {
              author: commit.author,
              commitDate: commit.commitDate,
              linesAdded: commit.linesAdded,
              linesDeleted: commit.linesDeleted,
              filesChanged: commit.filesChanged
            }
          });
        } catch {
          // skip duplicates
        }
      }
      setSourceCommits([]);
      setShowFetch(false);
      load();
    } finally {
      setCreating(false);
    }
  };

  const loadActivities = async (id: string) => {
    setActivitiesLoading(true);
    try {
      const data = await getCommitReviewJobActivities(id);
      setActivities(data);
    } catch {
      setActivities([]);
    } finally {
      setActivitiesLoading(false);
    }
  };

  const handleViewActivity = (id: string) => {
    setActivityJobId(id);
    setActivities([]);
    loadActivities(id);
  };

  const handleViewDetail = async (job: CommitReviewJobRow) => {
    setDetailJob(job);
    setDetailLoading(true);
    setDetailDimensions([]);
    try {
      const detail = await getCommitReviewJob(job.id);
      setDetailDimensions(detail.dimensions ?? []);
    } catch {
      // silent
    } finally {
      setDetailLoading(false);
    }
  };

  const handleProcess = async (id: string) => {
    setProcessingJobId(id);
    try {
      await processCommitReviewJob(id);
      load();
      if (detailJob?.id === id) handleViewDetail({ ...detailJob, status: "IN_PROGRESS" });
    } catch {
      // silent
    } finally {
      setProcessingJobId(null);
    }
  };

  const handleProcessPending = async () => {
    setProcessingJobId("__pending__");
    try {
      await processPendingCommitReviewJob();
      load();
    } catch {
      // silent
    } finally {
      setProcessingJobId(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCommitReviewJob(id);
      if (detailJob?.id === id) setDetailJob(null);
      load();
    } catch {
      // silent
    }
  };

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleString() : "—";

  return (
    <div className="commit-review-page">
      {/* Toolbar */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <input
          className="form-input"
          placeholder="Filter by repo..."
          value={filterRepo}
          onChange={(e) => { setFilterRepo(e.target.value); setPage(1); }}
          style={{ maxWidth: 250 }}
        />
        <select
          className="form-input"
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
          style={{ maxWidth: 150 }}
        >
          <option value="">All statuses</option>
          <option value="PENDING">PENDING</option>
          <option value="IN_PROGRESS">IN_PROGRESS</option>
          <option value="COMPLETED">COMPLETED</option>
          <option value="FAILED">FAILED</option>
        </select>
        <button className="btn btn--primary btn--sm" onClick={handleFetchLatest} disabled={fetching}>
          {fetching ? "Fetching..." : "Fetch Latest"}
        </button>
        <button className="btn btn--secondary btn--sm" onClick={handleProcessPending} disabled={processingJobId !== null}>
          {processingJobId === "__pending__" ? "Processing..." : "Process Pending"}
        </button>
        <button className="btn btn--secondary btn--sm" onClick={() => setShowCreate((v) => !v)}>
          + Create
        </button>
        <button className="btn btn--secondary btn--sm" onClick={() => load()} disabled={loading}>
          Refresh
        </button>
        <button className="btn btn--secondary btn--sm" onClick={() => {
          fetch("/api/commit-review-job/export", { headers: { "x-internal-api-key": import.meta.env.VITE_API_KEY as string } })
            .then((r) => r.blob())
            .then((blob) => {
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `commit-reviews-${new Date().toISOString().slice(0, 10)}.xlsx`;
              a.click();
              URL.revokeObjectURL(url);
            });
        }}>
          Download Report
        </button>
        <button className="btn btn--secondary btn--sm" onClick={() => {
          fetch("/api/commit-review-job/export-view", { headers: { "x-internal-api-key": import.meta.env.VITE_API_KEY as string } })
            .then((r) => r.blob())
            .then((blob) => {
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `commit-review-view-${new Date().toISOString().slice(0, 10)}.xlsx`;
              a.click();
              URL.revokeObjectURL(url);
            });
        }}>
          Download View
        </button>
      </div>

      {/* Manual Create Panel */}
      {showCreate && (
        <div style={{ marginBottom: 16, padding: 16, background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Owner</label>
              <input className="form-input" value={createOwner} onChange={(e) => setCreateOwner(e.target.value)} style={{ width: 120 }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Repository *</label>
              <input className="form-input" placeholder="e.g. rid-etf-onboarding_63623" value={createRepo} onChange={(e) => setCreateRepo(e.target.value)} style={{ width: 250 }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Commit SHA *</label>
              <input className="form-input" placeholder="e.g. a1b2c3d4e5f6" value={createCommit} onChange={(e) => setCreateCommit(e.target.value)} style={{ width: 300 }} />
            </div>
            <button className="btn btn--primary btn--sm" onClick={handleManualCreate} disabled={creatingManual || !createRepo.trim() || !createCommit.trim()}>
              {creatingManual ? "Creating..." : "Create Job"}
            </button>
            <button className="btn btn--secondary btn--sm" onClick={() => setShowCreate(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Fetch Latest Panel */}
      {showFetch && (
        <div style={{ marginBottom: 16, padding: 16, background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <strong>{sourceCommits.length} commits available</strong>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn--primary btn--sm" onClick={handleCreateAll} disabled={creating || sourceCommits.length === 0}>
                {creating ? "Creating..." : "Create All"}
              </button>
              <button className="btn btn--secondary btn--sm" onClick={() => setShowFetch(false)}>Close</button>
            </div>
          </div>
          {sourceCommits.length > 0 && (
            <div style={{ maxHeight: 300, overflow: "auto" }}>
              <table className="jobs-table" style={{ fontSize: 12 }}>
                <thead>
                  <tr><th>Repo</th><th>SHA</th><th>Author</th><th>Lines</th><th>Files</th><th>Date</th><th></th></tr>
                </thead>
                <tbody>
                  {sourceCommits.map((c) => (
                    <tr key={`${c.component}-${c.sha}`}>
                      <td>{c.component}</td>
                      <td className="job-id">{c.sha.slice(0, 7)}</td>
                      <td>{c.author}</td>
                      <td>+{c.linesAdded} / -{c.linesDeleted}</td>
                      <td>{c.filesChanged}</td>
                      <td>{formatDate(c.commitDate)}</td>
                      <td><button className="btn btn--secondary btn--sm" onClick={() => handleCreateJob(c)} disabled={creating}>Create</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Jobs Table */}
      {loading && <div className="commit-review-empty">Loading...</div>}

      {!loading && (
        <div className="jobs-table-wrapper">
          <table className="jobs-table">
            <thead>
              <tr>
                <th>Job ID</th>
                <th>Repo</th>
                <th>Commit</th>
                <th>Author</th>
                <th>Lines</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 && (
                <tr><td colSpan={8} className="commit-review-empty">No commit review jobs</td></tr>
              )}
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td>
                    <span className="job-id" style={{ cursor: "pointer", color: "#6366f1" }} onClick={() => handleViewDetail(job)}>
                      {job.id.slice(0, 8)}
                    </span>
                  </td>
                  <td>{job.githubRepo}</td>
                  <td className="job-id">{job.githubCommit.slice(0, 7)}</td>
                  <td>{job.requestPayload?.author ?? "—"}</td>
                  <td>+{job.requestPayload?.linesAdded ?? 0} / -{job.requestPayload?.linesDeleted ?? 0}</td>
                  <td>
                    <span className={`status-badge status-badge--${job.status.toLowerCase()}`}>
                      {job.status}
                    </span>
                  </td>
                  <td>{formatDate(job.createdAt)}</td>
                  <td>
                    <div className="actions-cell">
                      <button
                        className="action-btn action-btn--activity"
                        title="View Activity Log"
                        onClick={() => handleViewActivity(job.id)}
                      >
                        📋
                      </button>
                      {job.status === "PENDING" && (
                        <button
                          className="action-btn action-btn--process"
                          title="Process Job"
                          onClick={() => handleProcess(job.id)}
                          disabled={processingJobId === job.id}
                        >
                          {processingJobId === job.id ? "⏳" : "▶"}
                        </button>
                      )}
                      {job.status === "FAILED" && (
                        <button
                          className="action-btn action-btn--process"
                          title="Retry Job"
                          onClick={async () => { await retryCommitReviewJob(job.id); load(); }}
                        >
                          🔄
                        </button>
                      )}
                      <button
                        className="action-btn action-btn--clone"
                        title="Create from this job"
                        onClick={() => {
                          setCreateOwner(job.githubOwner);
                          setCreateRepo(job.githubRepo);
                          setCreateCommit("");
                          setShowCreate(true);
                        }}
                      >
                        ⧉
                      </button>
                      <button
                        className="action-btn action-btn--danger"
                        title="Delete Job"
                        onClick={() => handleDelete(job.id)}
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
      )}

      {pagination && (
        <Pagination
          meta={pagination}
          onPageChange={setPage}
          onLimitChange={(limit) => { setPage(1); setPageLimit(limit); }}
        />
      )}

      {/* Activity Modal */}
      {activityJobId && (
        <ActivityModal
          jobId={activityJobId}
          activities={activities}
          loading={activitiesLoading}
          onClose={() => setActivityJobId(null)}
          onRefresh={() => loadActivities(activityJobId)}
        />
      )}

      {/* Detail Modal */}
      {detailJob && (
        <div className="modal-backdrop" onClick={() => setDetailJob(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 800 }}>
            <div className="modal__header">
              <div>
                <h2 className="modal__title">Commit Review Details</h2>
                <p className="modal__subtitle" style={{ fontFamily: "monospace", fontSize: 12 }}>{detailJob.id}</p>
              </div>
              <button className="modal__close" onClick={() => setDetailJob(null)}>✕</button>
            </div>

            <div className="modal__body">
              {/* Metadata */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
                <div style={{ background: "#f9fafb", borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#9ca3af", marginBottom: 4 }}>Repository</div>
                  <div style={{ fontSize: 14 }}>{detailJob.githubOwner}/{detailJob.githubRepo}</div>
                </div>
                <div style={{ background: "#f9fafb", borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#9ca3af", marginBottom: 4 }}>Commit</div>
                  <div style={{ fontSize: 14, fontFamily: "monospace" }}>{detailJob.githubCommit}</div>
                </div>
                <div style={{ background: "#f9fafb", borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#9ca3af", marginBottom: 4 }}>Status</div>
                  <div style={{ fontSize: 14 }}>{detailJob.status}</div>
                </div>
                <div style={{ background: "#f9fafb", borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#9ca3af", marginBottom: 4 }}>Author</div>
                  <div style={{ fontSize: 14 }}>{detailJob.requestPayload?.author ?? "—"}</div>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                {detailJob.status === "PENDING" && (
                  <button className="btn btn--primary btn--sm" onClick={() => handleProcess(detailJob.id)} disabled={processingJobId === detailJob.id}>
                    {processingJobId === detailJob.id ? "Processing..." : "Process"}
                  </button>
                )}
                <button className="btn btn--danger btn--sm" onClick={() => handleDelete(detailJob.id)}>Delete</button>
              </div>

              {/* Error */}
              {detailJob.error && (
                <div style={{ marginBottom: 16, padding: 10, background: "#fef2f2", borderRadius: 6, color: "#dc2626", fontSize: 13 }}>
                  <strong>Error:</strong> {detailJob.error}
                </div>
              )}

              {/* Dimensions */}
              {detailLoading && <div style={{ color: "#9ca3af", marginBottom: 16 }}>Loading...</div>}

              {!detailLoading && detailDimensions.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <h4 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "#9ca3af", marginBottom: 8 }}>Dimensions</h4>
                  <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                        <th style={{ textAlign: "left", padding: "6px 8px" }}>Dimension</th>
                        <th style={{ textAlign: "center", padding: "6px 8px" }}>Result</th>
                        <th style={{ textAlign: "left", padding: "6px 8px" }}>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailDimensions.map((d) => (
                        <tr key={d.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                          <td style={{ padding: "6px 8px", fontFamily: "monospace" }}>{d.dimension}</td>
                          <td style={{ padding: "6px 8px", textAlign: "center" }}>
                            {d.type === "score" ? (
                              <span style={{ fontWeight: 600, color: (d.score ?? 0) <= 3 ? "#dc2626" : (d.score ?? 0) <= 6 ? "#d97706" : "#059669" }}>
                                {d.score}/10
                              </span>
                            ) : (
                              <span style={{ fontWeight: 600, color: d.flagged ? "#dc2626" : "#059669" }}>
                                {d.flagged ? "FLAGGED" : "OK"}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "6px 8px", color: "#374151" }}>{d.reason ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Results Summary */}
              {detailJob.results?.summary && (
                <div style={{ marginBottom: 16, padding: 10, background: "#eef2ff", borderRadius: 6, fontSize: 13 }}>
                  <strong>Summary:</strong> {typeof detailJob.results.summary === "string"
                    ? detailJob.results.summary
                    : detailJob.results.summary.executiveSummary ?? JSON.stringify(detailJob.results.summary)}
                </div>
              )}

              {detailJob.results && (
                <div style={{ marginBottom: 16 }}>
                  <details>
                    <summary style={{ fontSize: 12, cursor: "pointer", color: "#6366f1", marginBottom: 8 }}>Raw Results JSON</summary>
                    <pre style={{ background: "#1e1e2e", color: "#cdd6f4", padding: 14, borderRadius: 8, fontSize: 12, overflow: "auto", maxHeight: 400, whiteSpace: "pre-wrap" }}>
                      {JSON.stringify(detailJob.results, null, 2)}
                    </pre>
                  </details>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
