import { useState, useEffect, useCallback } from "react";
import { getReportViewPaginated, getJobTypes, dismissFinding, reactivateFinding } from "../api/jobApi";
import type { ReportView } from "../api/jobApi";
import type { ReviewJobType } from "../types/job.types";
import type {
  IssueJobRow,
  IssueDetailRow,
  MdJobRow,
  MdDetailRow,
  MdLabelRow,
  MdAudienceRow,
  PaginationMeta,
} from "../types/job.types";
import Pagination from "../components/Pagination";
import "./ReportsPage.css";

type ReportTab = ReportView;

export default function ReportsPage() {
  const [tab, setTab] = useState<ReportTab>("issue-job");
  const [loading, setLoading] = useState(false);

  // Findings export
  const [exportType, setExportType] = useState("PII");
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState("");
  const [jobTypes, setJobTypes] = useState<ReviewJobType[]>([]);

  useEffect(() => {
    getJobTypes().then(setJobTypes).catch(() => {});
  }, []);

  const handleExport = () => {
    const params = new URLSearchParams();
    if (exportType) params.set("reviewJobType", exportType);
    if (exportFrom) params.set("fromDate", exportFrom);
    if (exportTo) params.set("toDate", exportTo);
    const url = `/api/job/findings-export?${params.toString()}`;

    fetch(url, { headers: { "x-internal-api-key": import.meta.env.VITE_API_KEY as string } })
      .then((r) => r.blob())
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = `findings-${exportType || "all"}-${new Date().toISOString().slice(0, 10)}.xlsx`;
        link.click();
        URL.revokeObjectURL(blobUrl);
      });
  };

  const [issueJobs, setIssueJobs] = useState<IssueJobRow[]>([]);
  const [issueDetails, setIssueDetails] = useState<IssueDetailRow[]>([]);
  const [mdJobs, setMdJobs] = useState<MdJobRow[]>([]);
  const [mdDetails, setMdDetails] = useState<MdDetailRow[]>([]);
  const [mdLabels, setMdLabels] = useState<MdLabelRow[]>([]);
  const [mdAudiences, setMdAudiences] = useState<MdAudienceRow[]>([]);

  // Pagination state is shared across tabs and reset whenever the tab changes.
  const [page, setPage] = useState(1);
  const [pageLimit, setPageLimit] = useState(20);
  const [pageMeta, setPageMeta] = useState<PaginationMeta | null>(null);

  const loadTab = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: pageLimit };
      switch (tab) {
        case "issue-job": {
          const r = await getReportViewPaginated<IssueJobRow>("issue-job", params);
          setIssueJobs(r.data);
          setPageMeta(r.pagination);
          break;
        }
        case "issue-detail": {
          const r = await getReportViewPaginated<IssueDetailRow>("issue-detail", params);
          setIssueDetails(r.data);
          setPageMeta(r.pagination);
          break;
        }
        case "md-job": {
          const r = await getReportViewPaginated<MdJobRow>("md-job", params);
          setMdJobs(r.data);
          setPageMeta(r.pagination);
          break;
        }
        case "md-detail": {
          const r = await getReportViewPaginated<MdDetailRow>("md-detail", params);
          setMdDetails(r.data);
          setPageMeta(r.pagination);
          break;
        }
        case "md-label": {
          const r = await getReportViewPaginated<MdLabelRow>("md-label", params);
          setMdLabels(r.data);
          setPageMeta(r.pagination);
          break;
        }
        case "md-audience": {
          const r = await getReportViewPaginated<MdAudienceRow>("md-audience", params);
          setMdAudiences(r.data);
          setPageMeta(r.pagination);
          break;
        }
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [tab, page, pageLimit]);

  useEffect(() => {
    loadTab();
  }, [loadTab]);

  // Reset to the first page when switching tabs (each view is a different dataset).
  useEffect(() => {
    setPage(1);
  }, [tab]);

  const formatDate = (d: string) => d ? new Date(d).toLocaleString() : "—";
  const shortCommit = (c: string | null) => c ? c.slice(0, 7) : "—";

  const tabs: { key: ReportTab; label: string }[] = [
    { key: "issue-job", label: "Issue Jobs" },
    { key: "issue-detail", label: "Issue Details" },
    { key: "md-job", label: "MD Jobs" },
    { key: "md-detail", label: "MD Details" },
    { key: "md-label", label: "Labels" },
    { key: "md-audience", label: "Audiences" },
  ];

  return (
    <div className="reports-content">
      <div className="reports-export-card">
        <h4 className="reports-export-title">Findings Export</h4>
        <div className="reports-export-row">
          <div className="reports-export-field">
            <label className="form-label" style={{ fontSize: 12 }}>Job Type</label>
            <select
              className="form-input"
              value={exportType}
              onChange={(e) => setExportType(e.target.value)}
            >
              <option value="">All Types</option>
              {jobTypes.map((jt) => (
                <option key={jt.id} value={jt.id}>{jt.name}</option>
              ))}
            </select>
          </div>
          <div className="reports-export-field">
            <label className="form-label" style={{ fontSize: 12 }}>From Date</label>
            <input
              className="form-input"
              type="date"
              value={exportFrom}
              onChange={(e) => setExportFrom(e.target.value)}
            />
          </div>
          <div className="reports-export-field">
            <label className="form-label" style={{ fontSize: 12 }}>To Date</label>
            <input
              className="form-input"
              type="date"
              value={exportTo}
              onChange={(e) => setExportTo(e.target.value)}
            />
          </div>
          <button className="btn btn--primary btn--sm" onClick={handleExport}>
            Download Excel
          </button>
        </div>
      </div>

      <div className="reports-tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`reports-tab ${tab === t.key ? "reports-tab--active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && <div className="reports-state">Loading...</div>}

      {!loading && tab === "issue-job" && (
        <div className="reports-table-wrapper">
          <table className="reports-table">
            <thead>
              <tr>
                <th>Repo</th>
                <th>Branch</th>
                <th>Commit</th>
                <th>Type</th>
                <th>Total</th>
                <th>Critical</th>
                <th>High</th>
                <th>Medium</th>
                <th>Low</th>
                <th>App Cat ID</th>
                <th>STO</th>
                <th>Manager</th>
                <th>Confluence</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {issueJobs.length === 0 && (
                <tr><td colSpan={14} className="reports-empty">No data</td></tr>
              )}
              {issueJobs.map((row) => (
                <tr key={row.job_id}>
                  <td>{row.repo}</td>
                  <td>{row.branch}</td>
                  <td className="reports-mono">{shortCommit(row.commit)}</td>
                  <td><span className="reports-badge">{row.job_type}</span></td>
                  <td className="reports-num">{row.total_issues}</td>
                  <td className="reports-num reports-sev--critical">{row.critical_count}</td>
                  <td className="reports-num reports-sev--high">{row.high_count}</td>
                  <td className="reports-num reports-sev--medium">{row.medium_count}</td>
                  <td className="reports-num reports-sev--low">{row.low_count}</td>
                  <td className="reports-mono">{row.app_cat_id ?? "—"}</td>
                  <td>{(row.sto_emails ?? []).join(", ") || "—"}</td>
                  <td>{(row.manager_emails ?? []).join(", ") || "—"}</td>
                  <td>
                    {row.confluence_link ? (
                      <a href={row.confluence_link} target="_blank" rel="noreferrer" className="reports-link">View</a>
                    ) : "—"}
                  </td>
                  <td className="reports-date">{formatDate(row.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && tab === "issue-detail" && (
        <div className="reports-table-wrapper">
          <table className="reports-table">
            <thead>
              <tr>
                <th>Repo</th>
                <th>Branch</th>
                <th>Type</th>
                <th>Severity</th>
                <th>Category</th>
                <th>File</th>
                <th>Title</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {issueDetails.length === 0 && (
                <tr><td colSpan={9} className="reports-empty">No data</td></tr>
              )}
              {issueDetails.map((row, i) => (
                <tr key={`${row.finding_id ?? row.job_id}-${i}`}>
                  <td>{row.repo}</td>
                  <td>{row.branch}</td>
                  <td><span className="reports-badge">{row.job_type}</span></td>
                  <td><span className={`reports-sev-badge reports-sev-badge--${row.severity}`}>{row.severity}</span></td>
                  <td>{row.category}</td>
                  <td className="reports-mono reports-file" title={row.file}>{row.file}</td>
                  <td title={row.title}>{row.title}</td>
                  <td className="reports-date">{formatDate(row.created_at)}</td>
                  <td>
                    {row.finding_id && (
                      <button
                        className="btn btn--secondary btn--sm"
                        onClick={async () => {
                          await dismissFinding(row.finding_id);
                          loadTab();
                        }}
                        title="Dismiss this finding (won't fix)"
                      >
                        Dismiss
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && tab === "md-job" && (
        <div className="reports-table-wrapper">
          <table className="reports-table">
            <thead>
              <tr>
                <th>Repo</th>
                <th>Branch</th>
                <th>Commit</th>
                <th>Total MD</th>
                <th>Labels</th>
                <th>Audiences</th>
                <th>App Cat ID</th>
                <th>STO</th>
                <th>Manager</th>
                <th>Confluence</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {mdJobs.length === 0 && (
                <tr><td colSpan={11} className="reports-empty">No data</td></tr>
              )}
              {mdJobs.map((row) => (
                <tr key={row.job_id}>
                  <td>{row.repo}</td>
                  <td>{row.branch}</td>
                  <td className="reports-mono">{shortCommit(row.commit)}</td>
                  <td className="reports-num">{row.total_md}</td>
                  <td>
                    <div className="reports-breakdown">
                      {Object.entries(row.label_breakdown ?? {}).map(([k, v]) => (
                        <span key={k} className="reports-pill">{k}: {v}</span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <div className="reports-breakdown">
                      {Object.entries(row.audience_breakdown ?? {}).map(([k, v]) => (
                        <span key={k} className="reports-pill reports-pill--audience">{k}: {v}</span>
                      ))}
                    </div>
                  </td>
                  <td className="reports-mono">{row.app_cat_id ?? "—"}</td>
                  <td>{(row.sto_emails ?? []).join(", ") || "—"}</td>
                  <td>{(row.manager_emails ?? []).join(", ") || "—"}</td>
                  <td>
                    {row.confluence_link ? (
                      <a href={row.confluence_link} target="_blank" rel="noreferrer" className="reports-link">View</a>
                    ) : "—"}
                  </td>
                  <td className="reports-date">{formatDate(row.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && tab === "md-detail" && (
        <div className="reports-table-wrapper">
          <table className="reports-table">
            <thead>
              <tr>
                <th>Repo</th>
                <th>Branch</th>
                <th>Path</th>
                <th>Title</th>
                <th>Label</th>
                <th>Audience</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {mdDetails.length === 0 && (
                <tr><td colSpan={7} className="reports-empty">No data</td></tr>
              )}
              {mdDetails.map((row, i) => (
                <tr key={`${row.job_id}-${i}`}>
                  <td>{row.repo}</td>
                  <td>{row.branch}</td>
                  <td className="reports-mono reports-file" title={row.path}>{row.path}</td>
                  <td title={row.title}>{row.title}</td>
                  <td>
                    <div className="reports-breakdown">
                      {row.label.split(",").map((l) => (
                        <span key={l.trim()} className="reports-pill">{l.trim()}</span>
                      ))}
                    </div>
                  </td>
                  <td><span className="reports-pill reports-pill--audience">{row.audience}</span></td>
                  <td className="reports-date">{formatDate(row.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && tab === "md-label" && (
        <div className="reports-table-wrapper reports-table-wrapper--narrow">
          <table className="reports-table">
            <thead>
              <tr>
                <th>Label</th>
                <th>Total Count</th>
              </tr>
            </thead>
            <tbody>
              {mdLabels.length === 0 && (
                <tr><td colSpan={2} className="reports-empty">No data</td></tr>
              )}
              {mdLabels.map((row) => (
                <tr key={row.label}>
                  <td><span className="reports-pill">{row.label}</span></td>
                  <td className="reports-num">{row.total_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && tab === "md-audience" && (
        <div className="reports-table-wrapper reports-table-wrapper--narrow">
          <table className="reports-table">
            <thead>
              <tr>
                <th>Audience</th>
                <th>Total Count</th>
              </tr>
            </thead>
            <tbody>
              {mdAudiences.length === 0 && (
                <tr><td colSpan={2} className="reports-empty">No data</td></tr>
              )}
              {mdAudiences.map((row) => (
                <tr key={row.audience}>
                  <td><span className="reports-pill reports-pill--audience">{row.audience}</span></td>
                  <td className="reports-num">{row.total_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && (
        <Pagination
          meta={pageMeta}
          disabled={loading}
          onPageChange={setPage}
          onLimitChange={(limit) => {
            setPageLimit(limit);
            setPage(1);
          }}
        />
      )}
    </div>
  );
}
