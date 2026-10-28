import { useMemo, useState } from "react";
import {
  confirmProjectFinding,
  createScanSummaryEntry,
  dismissProjectFinding,
  reopenProjectFinding,
  startKnowledgeCollection,
} from "../../../api/jobApi";
import type { ProjectFinding, ProjectKnowledge } from "../../../types/job.types";
import { KnowledgeStatusBadge } from "../KnowledgeStatusBadge";

const SEVERITIES = ["critical", "high", "medium", "low"] as const;

type StatusFilter = "active" | "all" | "open" | "confirmed" | "dismissed" | "resolved";
const STATUS_FILTERS: Array<{ id: StatusFilter; label: string }> = [
  { id: "active", label: "Open & confirmed" },
  { id: "open", label: "Open" },
  { id: "confirmed", label: "Confirmed" },
  { id: "dismissed", label: "Dismissed" },
  { id: "resolved", label: "Resolved" },
  { id: "all", label: "All" },
];

type SourceKind = "flow" | "review" | "gap" | "test" | "other";
const SOURCE_LABELS: Record<SourceKind, string> = {
  flow: "Per-flow",
  review: "Review",
  gap: "Gap",
  test: "Testing",
  other: "Other",
};

/** Where a finding came from: the scan, review task or gap specialist entry that reported it. */
function sourceOf(
  f: ProjectFinding,
  byId: Map<string, ProjectKnowledge>,
): { kind: SourceKind; label: string } {
  const entry = f.projectKnowledgeId ? byId.get(f.projectKnowledgeId) : undefined;
  const key = entry?.key ?? "";
  if (key.startsWith("threat_map:")) return { kind: "flow", label: key.slice("threat_map:".length) };
  if (key.startsWith("review:")) return { kind: "review", label: key.split(":").pop() ?? "" };
  if (key.startsWith("gap:")) return { kind: "gap", label: key.split(":").pop() ?? "" };
  if (entry?.knowledgeType === "pentest_swarm" || entry?.knowledgeType === "security_test")
    return { kind: "test", label: "Pentest" };
  if (f.source === "pentest_swarm") return { kind: "test", label: "Pentest" };
  return { kind: "other", label: f.source ?? "—" };
}

const matchesStatus = (f: ProjectFinding, s: StatusFilter) =>
  s === "all" ||
  (s === "active" && (f.status === "open" || f.status === "confirmed")) ||
  (s === "dismissed" && (f.status === "dismissed" || f.status === "dismissed_by_user")) ||
  f.status === s;

/** Step 4: the reconciled findings, with the summary that keeps them current. */
export function FindingsTab({
  projectId,
  knowledge,
  findings,
  refresh,
  onView,
}: {
  projectId: string;
  knowledge: ProjectKnowledge[];
  findings: ProjectFinding[];
  refresh: () => Promise<void>;
  onView: (id: string) => void;
}) {
  const [severity, setSeverity] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusFilter>("active");
  const [source, setSource] = useState<SourceKind | null>(null);
  const [query, setQuery] = useState("");

  const summary = knowledge.find((k) => k.knowledgeType === "scan_summary");
  const hasResults = knowledge.some(
    (k) => k.knowledgeType === "security_scan" && k.status === "active",
  );
  const byId = useMemo(() => new Map(knowledge.map((k) => [k.id, k])), [knowledge]);
  const rows = useMemo(
    () => findings.map((f) => ({ f, src: sourceOf(f, byId) })),
    [findings, byId],
  );
  const inStatus = rows.filter(({ f }) => matchesStatus(f, status));
  const q = query.trim().toLowerCase();
  const shown = inStatus.filter(
    ({ f, src }) =>
      (!severity || f.severity === severity) &&
      (!source || src.kind === source) &&
      (!q || `${f.title} ${f.repo ?? ""} ${f.file ?? ""}`.toLowerCase().includes(q)),
  );
  const sources = [...new Set(rows.map((r) => r.src.kind))];

  const exportExcel = async () => {
    const res = await fetch(`/api/project/${encodeURIComponent(projectId)}/findings/export`, {
      headers: {
        "x-internal-api-key": (import.meta as { env: Record<string, string | undefined> }).env
          .VITE_API_KEY ?? "",
      },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download =
      res.headers.get("content-disposition")?.match(/filename="(.+)"/)?.[1] ?? "findings.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="pj-section">
      <div className="pj-section__head">
        <div>
          <h3 className="pj-section__title">Findings</h3>
          <p className="pj-hint">
            Every scan, review task and gap specialist's findings, de-duplicated and checked
            against the code by the findings summary.
          </p>
        </div>
        <div className="pj-row-actions">
          {findings.length > 0 && (
            <button className="btn btn--secondary btn--sm" onClick={exportExcel}>
              Export Excel
            </button>
          )}
        </div>
      </div>

      <div className="pj-entry-bar">
        <span className="pj-entry-bar__label">Findings summary</span>
        {summary ? (
          <>
            <KnowledgeStatusBadge status={summary.status} error={summary.error} />
            <span className="pj-muted">v{summary.version}</span>
            <span className="pj-entry-bar__stats">
              Runs after a review or gap analysis; run it again after rescanning on your own.
            </span>
            <div className="pj-row-actions">
              {summary.status !== "collecting" && (
                <button
                  className="btn btn--secondary btn--sm"
                  onClick={async () => {
                    await startKnowledgeCollection(projectId, summary.id);
                    await refresh();
                  }}
                >
                  Run again
                </button>
              )}
              <button className="btn btn--secondary btn--sm" onClick={() => onView(summary.id)}>
                View
              </button>
            </div>
          </>
        ) : (
          <>
            <span className="pj-entry-bar__stats">
              {hasResults ? "Not run yet." : "Runs once scans or a review have results."}
            </span>
            {hasResults && (
              <div className="pj-row-actions">
                <button
                  className="btn btn--primary btn--sm"
                  onClick={async () => {
                    const entry = await createScanSummaryEntry(projectId);
                    await startKnowledgeCollection(projectId, entry.id);
                    await refresh();
                  }}
                >
                  Generate summary
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {findings.length === 0 ? (
        <div className="pj-inline-empty">
          No findings yet. Run the analysis; its findings land here once the summary has run.
        </div>
      ) : (
        <>
          <div className="pj-filters" role="toolbar" aria-label="Filter findings">
            <div className="pj-chips">
              <button
                className={`pj-chip ${!severity ? "pj-chip--active" : ""}`}
                onClick={() => setSeverity(null)}
              >
                All severities <span className="pj-chip__n">{inStatus.length}</span>
              </button>
              {SEVERITIES.map((s) => {
                const n = inStatus.filter(({ f }) => f.severity === s).length;
                if (!n) return null;
                return (
                  <button
                    key={s}
                    className={`pj-chip pj-chip--${s} ${severity === s ? "pj-chip--active" : ""}`}
                    onClick={() => setSeverity(severity === s ? null : s)}
                    aria-pressed={severity === s}
                  >
                    {s} <span className="pj-chip__n">{n}</span>
                  </button>
                );
              })}
            </div>
            <div className="pj-filters__right">
              {sources.length > 1 && (
                <select
                  className="pj-select"
                  value={source ?? ""}
                  onChange={(e) => setSource((e.target.value || null) as SourceKind | null)}
                  aria-label="Source"
                >
                  <option value="">All sources</option>
                  {sources.map((s) => (
                    <option key={s} value={s}>
                      {SOURCE_LABELS[s]}
                    </option>
                  ))}
                </select>
              )}
              <select
                className="pj-select"
                value={status}
                onChange={(e) => setStatus(e.target.value as StatusFilter)}
                aria-label="Status"
              >
                {STATUS_FILTERS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label} ({rows.filter(({ f }) => matchesStatus(f, s.id)).length})
                  </option>
                ))}
              </select>
              <input
                className="pj-search"
                type="search"
                placeholder="Search title or file"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search findings"
              />
            </div>
          </div>

          {shown.length === 0 ? (
            <div className="pj-inline-empty">No findings match these filters.</div>
          ) : (
            <div className="pj-table-wrapper">
              <table className="pj-table">
                <thead>
                  <tr>
                    <th>Severity</th>
                    <th>Title</th>
                    <th>Location</th>
                    <th>Source</th>
                    <th>Status</th>
                    <th>Test</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map(({ f, src }) => (
                    <tr key={f.id}>
                      <td>
                        <span className={`pj-sev pj-sev--${f.severity}`}>{f.severity}</span>
                      </td>
                      <td className="pj-finding">
                        <details>
                          <summary>{f.title}</summary>
                          <dl className="pj-finding__body">
                            <dt>Category</dt>
                            <dd>{f.category}</dd>
                            <dt>Evidence</dt>
                            <dd>{f.evidence}</dd>
                            <dt>Why dangerous</dt>
                            <dd>{f.whyDangerous}</dd>
                            <dt>Failure mode</dt>
                            <dd>{f.failureMode}</dd>
                            <dt>Fix</dt>
                            <dd>{f.recommendedFix}</dd>
                            {f.whatWouldConfirm && (
                              <>
                                <dt>Would confirm</dt>
                                <dd>{f.whatWouldConfirm}</dd>
                              </>
                            )}
                            {f.dismissReason && (
                              <>
                                <dt>Dismissed</dt>
                                <dd>
                                  {f.dismissReason} ({f.dismissedBy})
                                </dd>
                              </>
                            )}
                          </dl>
                        </details>
                      </td>
                      <td className="pj-location">
                        {f.repo && <div className="pj-muted">{f.repo}</div>}
                        <div className="pj-mono">
                          {f.file
                            ? `${f.file}${f.lineStart ? `:${f.lineStart}` : ""}`
                            : (f.endpoint ?? "—")}
                        </div>
                      </td>
                      <td>
                        <span className="pj-source" title={SOURCE_LABELS[src.kind]}>
                          {SOURCE_LABELS[src.kind]}
                          {src.kind !== "other" && src.kind !== "test" && (
                            <span className="pj-mono"> {src.label}</span>
                          )}
                        </span>
                      </td>
                      <td>
                        <span className={`pj-fstatus pj-fstatus--${f.status}`}>
                          {f.status === "dismissed_by_user" ? "dismissed (you)" : f.status}
                        </span>
                      </td>
                      <td>
                        {f.testResult ? (
                          <span
                            className={`pj-pill ${f.testResult.result === "validated" ? "pj-pill--critical" : f.testResult.result === "not_exploitable" ? "pj-pill--resolved" : "pj-pill--muted"}`}
                          >
                            {f.testResult.result === "validated"
                              ? "validated"
                              : f.testResult.result === "not_exploitable"
                                ? "safe"
                                : "n/a"}
                          </span>
                        ) : (
                          <span className="pj-muted">—</span>
                        )}
                      </td>
                      <td className="pj-actions-cell">
                        <div className="pj-row-actions">
                          {(f.status === "open" || f.status === "dismissed") && (
                            <button
                              className="btn btn--secondary btn--sm"
                              onClick={async () => {
                                await confirmProjectFinding(projectId, f.id);
                                await refresh();
                              }}
                            >
                              Confirm
                            </button>
                          )}
                          {(f.status === "open" || f.status === "confirmed") && (
                            <button
                              className="btn btn--secondary btn--sm"
                              onClick={async () => {
                                const reason = prompt("Why is this not a real issue?");
                                if (!reason) return;
                                await dismissProjectFinding(projectId, f.id, reason);
                                await refresh();
                              }}
                            >
                              Dismiss
                            </button>
                          )}
                          {(f.status === "dismissed_by_user" || f.status === "resolved") && (
                            <button
                              className="btn btn--secondary btn--sm"
                              onClick={async () => {
                                await reopenProjectFinding(projectId, f.id);
                                await refresh();
                              }}
                            >
                              Reopen
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
