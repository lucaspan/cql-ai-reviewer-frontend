import { useState } from "react";
import {
  startSecurityReview,
} from "../../../api/jobApi";
import type {
  ProjectKnowledge,
  GapAnalysisValue,
  SecurityReviewOptions,
  SecurityReviewPhase,
  SecurityReviewValue,
} from "../../../types/job.types";
import { formatUsd, elapsed } from "../format";
import { REVIEW_STEPS, DEFAULT_REVIEW_OPTIONS, liveTask } from "../reviewModel";
import { ReviewNumberField, ReviewTaskTable, CoverageBlock, AttackChainsBlock } from "./ReviewParts";

/**
 * The whole-application security review: one coordinator plans review tasks, reviewers and
 * independent verifiers work them in parallel, and attack chains link the kept findings.
 */
export function SecurityReviewSection({
  projectId,
  knowledge,
  hasRepos,
  refresh,
  setViewingKnowledgeId,
  agentLine,
}: {
  projectId: string;
  knowledge: ProjectKnowledge[];
  hasRepos: boolean;
  refresh: () => Promise<void>;
  setViewingKnowledgeId: (id: string | null) => void;
  /** "3 agents running, 9 waiting for a slot", while anything is collecting. */
  agentLine: string | null;
}) {
  const run = knowledge.find((k) => k.knowledgeType === "security_review");
  const value = (run?.value ?? {}) as SecurityReviewValue;
  const running = run?.status === "collecting";
  // A run the server stopped on (phase "failed") or that a restart interrupted (status only)
  const failed = !running && (run?.status === "failed" || value.phase === "failed");
  const hasThreatMap = knowledge.some(
    (k) => k.knowledgeType === "threat_map" && k.status === "active",
  );
  const [options, setOptions] = useState<SecurityReviewOptions>({
    ...DEFAULT_REVIEW_OPTIONS,
    ...(value.options ?? {}),
  });
  const [showOptions, setShowOptions] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tasks = (value.tasks ?? []).map((t) => liveTask(t, knowledge));
  const kept = tasks.reduce((n, t) => n + (t.counts ? t.counts.total - t.counts.rejected : 0), 0);
  const rejected = tasks.reduce((n, t) => n + (t.counts?.rejected ?? 0), 0);
  const currentStep = value.phase
    ? REVIEW_STEPS.findIndex((s) => s.phases.includes(value.phase as SecurityReviewPhase))
    : -1;
  const gap = knowledge.find((k) => k.knowledgeType === "gap_analysis");
  const gapValue = (gap?.value ?? {}) as GapAnalysisValue;
  const gapRedrewChains =
    gap?.status === "active" &&
    !!value.runId &&
    gapValue.baseRunId === value.runId &&
    (gapValue.chains ?? []).length > 0;
  const gapRunning = gap?.status === "collecting";

  const start = async () => {
    setStarting(true);
    setError(null);
    try {
      await startSecurityReview(projectId, options);
      setShowOptions(false);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setStarting(false);
    }
  };

  const numberField = (
    label: string,
    key: "maxTasks" | "maxCostUsd",
    min: number,
    max: number,
    hint: string,
  ) => (
    <ReviewNumberField
      key={`${key}-${options[key]}`}
      label={label}
      hint={hint}
      value={options[key]}
      min={min}
      max={max}
      onCommit={(n) => setOptions((o) => ({ ...o, [key]: n }))}
    />
  );

  return (
    <section className="pj-section">
      <div className="pj-section__head">
        <div>
          <h3 className="pj-section__title">Security Review</h3>
          <p className="pj-hint" style={{ marginTop: 4 }}>
            Reviews the whole application: a coordinator plans tasks across the repositories,
            reviewers work them in parallel, a second model verifies every finding against the
            code, and an analyst links the kept findings into attack chains.
          </p>
        </div>
        <div className="pj-detail-actions">
          <button
            className="btn btn--secondary btn--sm"
            onClick={() => setShowOptions((v) => !v)}
            disabled={running}
            aria-expanded={showOptions}
          >
            Options
          </button>
          <button
            className="btn btn--primary btn--sm"
            onClick={start}
            disabled={starting || running || gapRunning || !hasRepos}
            title={
              !hasRepos
                ? "Add repositories first"
                : running
                  ? "A review is running"
                  : gapRunning
                    ? "A gap analysis is running"
                    : undefined
            }
          >
            {starting ? "Starting…" : running ? "Running…" : run?.status === "active" ? "Re-run Review" : "Start Review"}
          </button>
        </div>
      </div>

      {showOptions && (
        <div className="pj-review-options">
          {numberField("Review tasks", "maxTasks", 1, 20, "Planned by the coordinator")}
          {numberField("Budget ($)", "maxCostUsd", 1, 1000, "The attack chains are skipped once spending reaches it")}
          <label className="pj-review-check">
            <input
              type="checkbox"
              checked={options.includePerFlow}
              onChange={(e) => setOptions((o) => ({ ...o, includePerFlow: e.target.checked }))}
            />
            <span>
              Include per-flow scans
              <small>{hasThreatMap ? "Runs the per-flow scans that haven't run yet" : "Needs a threat map"}</small>
            </span>
          </label>
          <label className="pj-review-check">
            <input
              type="checkbox"
              checked={options.verify === "high"}
              onChange={(e) => setOptions((o) => ({ ...o, verify: e.target.checked ? "high" : "all" }))}
            />
            <span>
              Verify only high and critical findings
              <small>Cheaper; other findings stay unverified</small>
            </span>
          </label>
          <label className="pj-review-check">
            <input
              type="checkbox"
              checked={options.summarize}
              onChange={(e) => setOptions((o) => ({ ...o, summarize: e.target.checked }))}
            />
            <span>
              Update the findings summary when done
              <small>Reconciles the kept findings into the Findings list</small>
            </span>
          </label>
        </div>
      )}

      {error && <div className="pj-review-error">{error}</div>}

      {!run || !value.runId ? (
        <div className="pj-inline-empty">
          {hasRepos
            ? "No review yet. Repo profiles, an endpoint inventory and a threat map give the coordinator the most to work with."
            : "Add repositories to run a review."}
        </div>
      ) : (
        <>
          <ol className="pj-review-steps" aria-label="Review progress">
            {REVIEW_STEPS.map((step, i) => {
              const state =
                failed
                  ? i <= Math.max(0, currentStep) ? "failed" : "todo"
                  : i < currentStep || value.phase === "done"
                    ? "done"
                    : i === currentStep
                      ? "current"
                      : "todo";
              return (
                <li key={step.label} className={`pj-review-step pj-review-step--${state}`}>
                  {step.label}
                </li>
              );
            })}
          </ol>

          <div className="pj-metrics">
            <span>
              {running ? "Running for" : failed ? "Failed after" : "Finished in"}{" "}
              {elapsed(value.startedAt, value.finishedAt ?? (running ? null : run.updatedAt))}
              {running && <span className="pj-muted"> · refreshing</span>}
            </span>
            <span>
              Spent {formatUsd(value.spentUsd)} of ${value.options?.maxCostUsd ?? "?"}
            </span>
            <span>{tasks.length} task(s)</span>
            {running && agentLine && <span className="pj-muted">{agentLine}</span>}
            <span style={{ color: "#dc2626" }}>{kept} kept finding(s)</span>
            {rejected > 0 && <span className="pj-muted">{rejected} rejected by verifiers</span>}
            {value.perFlow && (
              <span>
                Per-flow scans {value.perFlow.done}/{value.perFlow.total}
                {value.perFlow.failed > 0 && <span style={{ color: "#dc2626" }}> ({value.perFlow.failed} failed)</span>}
              </span>
            )}
            <button className="btn btn--secondary btn--sm" onClick={() => setViewingKnowledgeId(run.id)}>
              Report & activity
            </button>
          </div>

          {run.status === "failed" && run.error && <div className="pj-review-error">{run.error}</div>}

          {value.planSummary && (
            <details className="pj-review-details" open={running}>
              <summary>Plan</summary>
              <p>{value.planSummary}</p>
            </details>
          )}

          {tasks.length > 0 && (
            <ReviewTaskTable
              tasks={tasks}
              projectId={projectId}
              refresh={refresh}
              setViewingKnowledgeId={setViewingKnowledgeId}
            />
          )}

          <CoverageBlock rows={value.coverage ?? []} />

          {gapRedrewChains && (
            <p className="pj-hint">
              The gap analysis below found more and redrew the attack chains; these are from the
              review alone.
            </p>
          )}
          <AttackChainsBlock chains={value.chains ?? []} summary={value.chainSummary ?? null} />

          {(value.notes ?? []).length > 0 && (
            <details className="pj-review-details">
              <summary>Notes ({value.notes!.length})</summary>
              <ul>
                {value.notes!.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  );
}
