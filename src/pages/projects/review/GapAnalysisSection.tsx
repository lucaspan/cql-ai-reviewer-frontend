import { useState } from "react";
import {
  startGapAnalysis,
} from "../../../api/jobApi";
import type {
  ProjectKnowledge,
  GapAnalysisOptions,
  GapAnalysisPhase,
  GapAnalysisValue,
  SecurityReviewValue,
} from "../../../types/job.types";
import { formatUsd, elapsed } from "../format";
import { GAP_STEPS, DEFAULT_GAP_OPTIONS, liveTask } from "../reviewModel";
import { ReviewNumberField, ReviewTaskTable, CoverageBlock, AttackChainsBlock } from "./ReviewParts";

/**
 * Optional, after the per-flow scans or a review: a coordinator reads everything that ran and
 * sends specialists to what was missed, in rounds, then redraws the attack chains.
 */
export function GapAnalysisSection({
  projectId,
  knowledge,
  refresh,
  setViewingKnowledgeId,
  agentLine,
}: {
  projectId: string;
  knowledge: ProjectKnowledge[];
  refresh: () => Promise<void>;
  setViewingKnowledgeId: (id: string | null) => void;
  agentLine: string | null;
}) {
  const gap = knowledge.find((k) => k.knowledgeType === "gap_analysis");
  const value = (gap?.value ?? {}) as GapAnalysisValue;
  const review = knowledge.find((k) => k.knowledgeType === "security_review");
  const reviewRunId = (review?.value as SecurityReviewValue | undefined)?.runId ?? null;
  const reviewRunning = review?.status === "collecting";
  const running = gap?.status === "collecting";
  const failed = !running && (gap?.status === "failed" || value.phase === "failed");
  const hasResults = knowledge.some(
    (k) => k.knowledgeType === "security_scan" && k.status === "active",
  );
  // A newer review run replaced the results this analysis built on
  const superseded = !!value.runId && !running && (value.baseRunId ?? null) !== reviewRunId;
  const [options, setOptions] = useState<GapAnalysisOptions>({
    ...DEFAULT_GAP_OPTIONS,
    ...(value.options ?? {}),
  });
  const [showOptions, setShowOptions] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tasks = (value.tasks ?? []).map((t) => liveTask(t, knowledge));
  const kept = tasks.reduce((n, t) => n + (t.counts ? t.counts.total - t.counts.rejected : 0), 0);
  const rejected = tasks.reduce((n, t) => n + (t.counts?.rejected ?? 0), 0);
  const rounds = value.rounds ?? [];
  const currentStep = value.phase
    ? GAP_STEPS.findIndex((s) => s.phases.includes(value.phase as GapAnalysisPhase))
    : -1;

  const start = async () => {
    setStarting(true);
    setError(null);
    try {
      await startGapAnalysis(projectId, options);
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
    key: "maxRounds" | "maxTasksPerRound" | "maxCostUsd",
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

  const blocked = !hasResults
    ? "Run the per-flow scans or a security review first"
    : reviewRunning
      ? "A security review is running"
      : running
        ? "A gap analysis is running"
        : undefined;

  return (
    <section className="pj-section">
      <div className="pj-section__head">
        <div>
          <h3 className="pj-section__title">Gap Analysis</h3>
          <p className="pj-hint" style={{ marginTop: 4 }}>
            Optional. A coordinator reads everything that already ran (per-flow scans, the latest
            review, earlier gap rounds) and sends specialists to what was missed, in rounds until it
            finds no more gaps. Each specialist is a reviewer and a verifier. Redraws the attack
            chains when they find something.
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
            disabled={starting || !!blocked}
            title={blocked}
          >
            {starting ? "Starting…" : running ? "Running…" : gap?.status === "active" ? "Run Again" : "Start Gap Analysis"}
          </button>
        </div>
      </div>

      {showOptions && (
        <div className="pj-review-options">
          {numberField("Rounds", "maxRounds", 1, 5, "Stops early when the coordinator finds no gap")}
          {numberField("Specialists per round", "maxTasksPerRound", 1, 10, "The coordinator may deploy fewer")}
          {numberField("Budget ($)", "maxCostUsd", 1, 1000, "No new round starts once spending reaches it")}
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
              <small>Only when specialists found something</small>
            </span>
          </label>
        </div>
      )}

      {error && <div className="pj-review-error">{error}</div>}

      {!gap || !value.runId ? (
        <div className="pj-inline-empty">
          {hasResults
            ? "Not run yet. Best after the per-flow scans and a security review."
            : "Run the per-flow scans or a security review first."}
        </div>
      ) : (
        <>
          <ol className="pj-review-steps" aria-label="Gap analysis progress">
            {GAP_STEPS.map((step, i) => {
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
                  {step.phases.includes("planning") && rounds.length > 0 && ` (round ${rounds.length})`}
                </li>
              );
            })}
          </ol>

          <div className="pj-metrics">
            <span>
              {running ? "Running for" : failed ? "Failed after" : "Finished in"}{" "}
              {elapsed(value.startedAt, value.finishedAt ?? (running ? null : gap.updatedAt))}
              {running && <span className="pj-muted"> · refreshing</span>}
            </span>
            <span>
              Spent {formatUsd(value.spentUsd)} of ${value.options?.maxCostUsd ?? "?"}
            </span>
            <span>{rounds.length} round(s)</span>
            <span>{tasks.length} specialist(s)</span>
            {running && agentLine && <span className="pj-muted">{agentLine}</span>}
            <span style={{ color: kept ? "#dc2626" : undefined }}>{kept} new kept finding(s)</span>
            {rejected > 0 && <span className="pj-muted">{rejected} rejected by verifiers</span>}
            <button className="btn btn--secondary btn--sm" onClick={() => setViewingKnowledgeId(gap.id)}>
              Report & activity
            </button>
          </div>

          {superseded && (
            <div className="pj-review-error">
              A newer security review ran after this analysis, so its specialists' findings no
              longer count. Run it again to check the new review.
            </div>
          )}
          {gap.status === "failed" && gap.error && <div className="pj-review-error">{gap.error}</div>}

          {rounds.length > 0 && (
            <details className="pj-review-details" open={running}>
              <summary>Rounds</summary>
              {rounds.map((r) => (
                <p key={r.round}>
                  <strong>
                    Round {r.round}
                    {r.taskIds.length ? ` (${r.taskIds.join(", ")})` : " (no gaps)"}:
                  </strong>{" "}
                  {r.summary}
                </p>
              ))}
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

          <CoverageBlock rows={value.coverage ?? []} before={value.coverageBefore} />
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
