import { useState } from "react";
import {
  startKnowledgeCollection,
} from "../../../api/jobApi";
import type {
  CoverageRow,
  SecurityReviewChain,
  SecurityReviewTask,
} from "../../../types/job.types";
import { formatUsd, withoutRefs } from "../format";
import { FOCUS_AREA_LABELS } from "../reviewModel";
import { KnowledgeStatusBadge } from "../KnowledgeStatusBadge";

/** A number field that may be empty while typing and is clamped when it loses focus. */
export function ReviewNumberField({
  label,
  hint,
  value,
  min,
  max,
  onCommit,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const commit = () => {
    const n = Number(draft);
    const next = draft.trim() === "" || !Number.isFinite(n) ? value : Math.min(max, Math.max(min, Math.round(n)));
    setDraft(String(next));
    if (next !== value) onCommit(next);
  };
  return (
    <label className="pj-review-field">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
      />
      <small>{hint}</small>
    </label>
  );
}


/** Review tasks or gap specialists, with their live status, verdicts and cost. */
export function ReviewTaskTable({
  tasks,
  projectId,
  refresh,
  setViewingKnowledgeId,
}: {
  tasks: SecurityReviewTask[];
  projectId: string;
  refresh: () => Promise<void>;
  setViewingKnowledgeId: (id: string | null) => void;
}) {
  return (
    <div className="pj-table-wrapper">
      <table className="pj-table">
        <thead>
          <tr>
            <th>Task</th>
            <th>Scope</th>
            <th>Status</th>
            <th title="Checks the reviewer answered with a finding or a pass">Checks</th>
            <th title="Kept (confirmed, corrected or unverified) / rejected by the verifier">Findings</th>
            <th>Cost</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => {
            const c = t.counts;
            const scope = [...t.paths, ...(t.paths.length ? [] : t.repos)].join(", ");
            return (
              <tr key={t.id}>
                <td>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span className="pj-mono">{t.id}</span>
                    <span className="pj-pill">{FOCUS_AREA_LABELS[t.focusArea] ?? t.focusArea}</span>
                  </div>
                  <div style={{ marginTop: 2 }}>{t.title}</div>
                </td>
                <td className="pj-review-scope" title={[...t.repos, ...t.paths].join("\n")}>
                  {scope}
                </td>
                <td>
                  <KnowledgeStatusBadge status={t.status} error={t.error ?? null} />
                </td>
                <td>
                  {t.checksAnswered !== undefined ? `${t.checksAnswered}/${t.checks.length}` : `—/${t.checks.length}`}
                </td>
                <td>
                  {c ? (
                    <span>
                      <span style={{ color: c.total - c.rejected ? "#dc2626" : undefined }}>{c.total - c.rejected}</span>
                      <span className="pj-muted"> / {c.rejected}</span>
                      {c.unverified > 0 && (
                        <span className="pj-muted" title="No verifier verdict"> · {c.unverified} unverified</span>
                      )}
                    </span>
                  ) : (
                    <span className="pj-muted">—</span>
                  )}
                </td>
                <td>{formatUsd(t.costUsd)}</td>
                <td className="pj-actions-cell">
                  {t.status === "failed" && t.knowledgeId && (
                    <button
                      className="btn btn--primary btn--sm"
                      onClick={async () => {
                        await startKnowledgeCollection(projectId, t.knowledgeId!);
                        await refresh();
                      }}
                    >
                      Retry
                    </button>
                  )}
                  {t.knowledgeId && (
                    <button
                      className="btn btn--secondary btn--sm"
                      onClick={() => setViewingKnowledgeId(t.knowledgeId)}
                    >
                      View
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Source files opened per repository; with `before`, how the coverage grew. */
export function CoverageBlock({ rows, before }: { rows: CoverageRow[]; before?: CoverageRow[] }) {
  if (!rows.length) return null;
  return (
    <div className="pj-review-block">
      <div className="pj-review-block__title">Coverage</div>
      <p className="pj-hint">
        Source files any agent opened. Files that were only searched are not counted, so this is a
        lower bound.
      </p>
      {rows.map((r) => {
        const pct = r.sourceFiles ? Math.round((r.filesRead / r.sourceFiles) * 100) : 0;
        const was = before?.find((b) => b.repo === r.repo);
        return (
          <div key={r.repo} className="pj-review-coverage">
            <div className="pj-review-coverage__head">
              <span className="pj-mono">{r.repo}</span>
              <span>
                {was && was.filesRead !== r.filesRead ? `${was.filesRead} → ` : ""}
                {r.filesRead} of {r.sourceFiles} files ({pct}%)
              </span>
            </div>
            <div className="pj-review-bar">
              <div style={{ width: `${pct}%` }} />
            </div>
            {r.unreadDirs.length > 0 && (
              <div className="pj-hint">
                Not opened: {r.unreadDirs.slice(0, 4).map((d) => `${d.dir} (${d.sourceFiles})`).join(", ")}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function AttackChainsBlock({
  chains,
  summary,
}: {
  chains: SecurityReviewChain[];
  summary: string | null;
}) {
  if (!chains.length && !summary) return null;
  return (
    <div className="pj-review-block">
      <div className="pj-review-block__title">Attack chains</div>
      {summary && <p className="pj-review-text">{withoutRefs(summary)}</p>}
      {chains.map((c, i) => (
        <details key={i} className="pj-review-chain">
          <summary>
            <span className={`pj-pill ${c.severity === "critical" || c.severity === "high" ? "pj-pill--critical" : "pj-pill--muted"}`}>
              {c.severity}
            </span>{" "}
            {c.title}
          </summary>
          <div className="pj-review-text">
            <div>
              <strong>Starts from:</strong> {withoutRefs(c.entryPoint)}
            </div>
            <div>
              <strong>Impact:</strong> {withoutRefs(c.impact)}
            </div>
            <ol>
              {c.steps.map((s, j) => (
                <li key={j}>
                  {s.title ?? s.findingRef}
                  {s.location && <span className="pj-mono pj-muted"> {s.location}</span>}
                  <div className="pj-muted">{s.role}</div>
                </li>
              ))}
            </ol>
            <p>{withoutRefs(c.narrative)}</p>
          </div>
        </details>
      ))}
    </div>
  );
}
