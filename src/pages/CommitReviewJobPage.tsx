import { useState, useEffect, useCallback } from "react";
import { getCommitReviewJobs, getCommitReviewJob, fetchLatestCommits, createCommitReviewJob } from "../api/jobApi";
import Pagination from "../components/Pagination";
import "./ReportsPage.css";

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
  const [loading, setLoading] = useState(true);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<DimensionRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const [filterRepo, setFilterRepo] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Fetch latest commits from source
  const [showFetch, setShowFetch] = useState(false);
  const [sourceCommits, setSourceCommits] = useState<SourceCommit[]>([]);
  const [fetching, setFetching] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getCommitReviewJobs({
        page,
        limit: 20,
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
  }, [page, filterRepo, filterStatus]);

  useEffect(() => { load(); }, [load]);

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
      // silent - likely duplicate
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

  const handleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    setDetailLoading(true);
    try {
      const detail = await getCommitReviewJob(id);
      setDimensions(detail.dimensions ?? []);
    } catch {
      setDimensions([]);
    } finally {
      setDetailLoading(false);
    }
  };

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleString() : "—";

  return (
    <div className="reports-content">
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
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
          {fetching ? "Fetching..." : "Fetch Latest Commits"}
        </button>
      </div>

      {showFetch && (
        <div style={{ marginBottom: 16, padding: 16, background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <strong>{sourceCommits.length} commits available</strong>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn--primary btn--sm" onClick={handleCreateAll} disabled={creating || sourceCommits.length === 0}>
                {creating ? "Creating..." : "Create All"}
              </button>
              <button className="btn btn--secondary btn--sm" onClick={() => setShowFetch(false)}>
                Close
              </button>
            </div>
          </div>
          {sourceCommits.length > 0 && (
            <div style={{ maxHeight: 300, overflow: "auto" }}>
              <table className="reports-table" style={{ fontSize: 12 }}>
                <thead>
                  <tr>
                    <th>Repo</th>
                    <th>SHA</th>
                    <th>Author</th>
                    <th>Lines</th>
                    <th>Files</th>
                    <th>Date</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sourceCommits.map((c) => (
                    <tr key={`${c.component}-${c.sha}`}>
                      <td>{c.component}</td>
                      <td className="reports-mono">{c.sha.slice(0, 7)}</td>
                      <td>{c.author}</td>
                      <td className="reports-num">+{c.linesAdded} / -{c.linesDeleted}</td>
                      <td className="reports-num">{c.filesChanged}</td>
                      <td className="reports-date">{formatDate(c.commitDate)}</td>
                      <td>
                        <button className="btn btn--secondary btn--sm" onClick={() => handleCreateJob(c)} disabled={creating}>
                          Create
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {loading && <div className="reports-empty">Loading...</div>}

      {!loading && (
        <div className="reports-table-wrapper">
          <table className="reports-table">
            <thead>
              <tr>
                <th>Repo</th>
                <th>Commit</th>
                <th>Author</th>
                <th>Lines</th>
                <th>Files</th>
                <th>Status</th>
                <th>Completed</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 && (
                <tr><td colSpan={8} className="reports-empty">No commit review jobs</td></tr>
              )}
              {jobs.map((job) => (
                <>
                  <tr
                    key={job.id}
                    onClick={() => handleExpand(job.id)}
                    style={{ cursor: "pointer" }}
                  >
                    <td>{job.githubRepo}</td>
                    <td className="reports-mono">{job.githubCommit.slice(0, 7)}</td>
                    <td>{job.requestPayload?.author ?? "—"}</td>
                    <td className="reports-num">
                      +{job.requestPayload?.linesAdded ?? 0} / -{job.requestPayload?.linesDeleted ?? 0}
                    </td>
                    <td className="reports-num">{job.requestPayload?.filesChanged ?? "—"}</td>
                    <td>
                      <span className={`reports-badge ${job.status === "COMPLETED" ? "reports-badge--ok" : job.status === "FAILED" ? "reports-badge--err" : ""}`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="reports-date">{formatDate(job.completedAt)}</td>
                    <td className="reports-date">{formatDate(job.createdAt)}</td>
                  </tr>
                  {expandedId === job.id && (
                    <tr key={`${job.id}-detail`}>
                      <td colSpan={8} style={{ background: "#f9fafb", padding: 16 }}>
                        {detailLoading && <div>Loading dimensions...</div>}
                        {!detailLoading && dimensions.length === 0 && <div style={{ color: "#9ca3af" }}>No dimensions scored yet</div>}
                        {!detailLoading && dimensions.length > 0 && (
                          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                            <thead>
                              <tr>
                                <th style={{ textAlign: "left", padding: "4px 8px" }}>Dimension</th>
                                <th style={{ textAlign: "left", padding: "4px 8px" }}>Type</th>
                                <th style={{ textAlign: "center", padding: "4px 8px" }}>Score/Flag</th>
                                <th style={{ textAlign: "left", padding: "4px 8px" }}>Reason</th>
                              </tr>
                            </thead>
                            <tbody>
                              {dimensions.map((d) => (
                                <tr key={d.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                                  <td style={{ padding: "4px 8px", fontFamily: "monospace" }}>{d.dimension}</td>
                                  <td style={{ padding: "4px 8px" }}>{d.type}</td>
                                  <td style={{ padding: "4px 8px", textAlign: "center" }}>
                                    {d.type === "score" ? (
                                      <span style={{ fontWeight: 600, color: (d.score ?? 0) >= 7 ? "#dc2626" : (d.score ?? 0) >= 4 ? "#d97706" : "#059669" }}>
                                        {d.score}/10
                                      </span>
                                    ) : (
                                      <span style={{ fontWeight: 600, color: d.flagged ? "#dc2626" : "#059669" }}>
                                        {d.flagged ? "FLAGGED" : "OK"}
                                      </span>
                                    )}
                                  </td>
                                  <td style={{ padding: "4px 8px", color: "#374151" }}>{d.reason ?? "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                        {job.results?.summary && (
                          <div style={{ marginTop: 12, padding: "8px 12px", background: "#eef2ff", borderRadius: 6, fontSize: 13 }}>
                            <strong>Summary:</strong> {job.results.summary}
                          </div>
                        )}
                        {job.error && (
                          <div style={{ marginTop: 8, padding: "8px 12px", background: "#fef2f2", borderRadius: 6, fontSize: 13, color: "#dc2626" }}>
                            <strong>Error:</strong> {job.error}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination && (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
