import { useState, useEffect } from "react";
import {
  getIssueJobView,
  getIssueDetailView,
  getMdJobView,
  getMdDetailView,
  getMdLabelView,
  getMdAudienceView,
} from "../api/jobApi";
import type {
  IssueJobRow,
  IssueDetailRow,
  MdJobRow,
  MdDetailRow,
  MdLabelRow,
  MdAudienceRow,
} from "../types/job.types";
import "./ReportsPage.css";

type ReportTab = "issue-job" | "issue-detail" | "md-job" | "md-detail" | "md-label" | "md-audience";

export default function ReportsPage() {
  const [tab, setTab] = useState<ReportTab>("issue-job");
  const [loading, setLoading] = useState(false);

  const [issueJobs, setIssueJobs] = useState<IssueJobRow[]>([]);
  const [issueDetails, setIssueDetails] = useState<IssueDetailRow[]>([]);
  const [mdJobs, setMdJobs] = useState<MdJobRow[]>([]);
  const [mdDetails, setMdDetails] = useState<MdDetailRow[]>([]);
  const [mdLabels, setMdLabels] = useState<MdLabelRow[]>([]);
  const [mdAudiences, setMdAudiences] = useState<MdAudienceRow[]>([]);

  useEffect(() => {
    loadTab(tab);
  }, [tab]);

  const loadTab = async (t: ReportTab) => {
    setLoading(true);
    try {
      switch (t) {
        case "issue-job": setIssueJobs(await getIssueJobView()); break;
        case "issue-detail": setIssueDetails(await getIssueDetailView()); break;
        case "md-job": setMdJobs(await getMdJobView()); break;
        case "md-detail": setMdDetails(await getMdDetailView()); break;
        case "md-label": setMdLabels(await getMdLabelView()); break;
        case "md-audience": setMdAudiences(await getMdAudienceView()); break;
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

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
                <th>Confluence</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {issueJobs.length === 0 && (
                <tr><td colSpan={11} className="reports-empty">No data</td></tr>
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
              </tr>
            </thead>
            <tbody>
              {issueDetails.length === 0 && (
                <tr><td colSpan={8} className="reports-empty">No data</td></tr>
              )}
              {issueDetails.map((row, i) => (
                <tr key={`${row.job_id}-${i}`}>
                  <td>{row.repo}</td>
                  <td>{row.branch}</td>
                  <td><span className="reports-badge">{row.job_type}</span></td>
                  <td><span className={`reports-sev-badge reports-sev-badge--${row.severity}`}>{row.severity}</span></td>
                  <td>{row.category}</td>
                  <td className="reports-mono reports-file" title={row.file}>{row.file}</td>
                  <td title={row.title}>{row.title}</td>
                  <td className="reports-date">{formatDate(row.created_at)}</td>
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
                <th>Confluence</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {mdJobs.length === 0 && (
                <tr><td colSpan={8} className="reports-empty">No data</td></tr>
              )}
              {mdJobs.map((row) => (
                <tr key={row.job_id}>
                  <td>{row.repo}</td>
                  <td>{row.branch}</td>
                  <td className="reports-mono">{shortCommit(row.commit)}</td>
                  <td className="reports-num">{row.total_md}</td>
                  <td>
                    <div className="reports-breakdown">
                      {Object.entries(row.label_breakdown).map(([k, v]) => (
                        <span key={k} className="reports-pill">{k}: {v}</span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <div className="reports-breakdown">
                      {Object.entries(row.audience_breakdown).map(([k, v]) => (
                        <span key={k} className="reports-pill reports-pill--audience">{k}: {v}</span>
                      ))}
                    </div>
                  </td>
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
    </div>
  );
}
