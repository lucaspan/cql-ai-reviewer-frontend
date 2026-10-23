import { Fragment, useEffect, useMemo, useState } from "react";
import { getJobCost } from "../api/jobApi";
import type {
  JobCostDetail,
  JobCostRow,
  JobCostRun,
} from "../types/cost.types";
import {
  KIND_LABEL,
  RUN_KIND_LABEL,
  SOURCE_TOOLTIP,
  entriesLabel,
  errorMessage,
  formatCost,
  formatDate,
  formatDateTime,
  formatTokens,
  knowledgeTypeLabel,
  shortModel,
} from "../utils/costFormat";
import "./Modal.css";
import "../pages/CostsPage.css";

const ROUTER_MISMATCH_RATIO = 0.01;
const RUN_COLUMNS = 8;

interface JobCostModalProps {
  row: JobCostRow;
  onClose: () => void;
}

export default function JobCostModal({ row, onClose }: JobCostModalProps) {
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<{
    req: unknown;
    detail: JobCostDetail | null;
    error: string | null;
  } | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [entryFilter, setEntryFilter] = useState<string | null>(null);

  const req = useMemo(
    () => ({ kind: row.kind, id: row.id, attempt }),
    [row.kind, row.id, attempt],
  );

  useEffect(() => {
    let cancelled = false;
    getJobCost(req.kind, req.id)
      .then((data) => {
        if (!cancelled) setSettled({ req, detail: data, error: null });
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setSettled({ req, detail: null, error: errorMessage(e) });
      });
    return () => {
      cancelled = true;
    };
  }, [req]);

  const loading = settled?.req !== req;
  const detail = loading ? null : (settled?.detail ?? null);
  const error = loading ? null : (settled?.error ?? null);

  const job = detail?.job ?? row;
  const isKnowledge = job.kind === "project_knowledge";
  const subtitle = (
    isKnowledge
      ? [
          KIND_LABEL[job.kind],
          knowledgeTypeLabel(job.subtype),
          entriesLabel(job.entries),
          `last run ${formatDate(job.createdAt)}`,
        ]
      : [
          KIND_LABEL[job.kind],
          job.subtype,
          job.ref,
          job.status,
          formatDate(job.createdAt),
        ]
  )
    .filter(Boolean)
    .join(" · ");
  const runColumns = isKnowledge ? RUN_COLUMNS + 1 : RUN_COLUMNS;
  const entries = detail?.entries ?? null;
  const selectedEntry = entries?.find((e) => e.id === entryFilter) ?? null;
  // Keep each run's position in the full list so numbering and expansion survive filtering.
  const visibleRuns = (detail?.runs ?? [])
    .map((run, index) => ({ run, index }))
    .filter(({ run }) => !entryFilter || run.entry?.id === entryFilter);

  const toggle = (i: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const router = detail?.router ?? null;
  const routerDiffers =
    router != null &&
    Math.abs(router.costUsd - job.totalCost) >
      ROUTER_MISMATCH_RATIO * job.totalCost;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal costs-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <div>
            <h2 className="modal__title">{job.title}</h2>
            <p className="modal__subtitle">{subtitle}</p>
          </div>
          <div className="costs-modal__header-right">
            <span className="costs-modal__total">
              {formatCost(job.totalCost)}
            </span>
            <button
              className="modal__close"
              onClick={onClose}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="modal__body">
          {loading && <div className="modal-state">Loading cost…</div>}

          {!loading && error && (
            <div className="costs-state">
              <p className="costs-error">{error}</p>
              <button
                className="btn btn--secondary"
                onClick={() => setAttempt((a) => a + 1)}
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && detail && (
            <>
              {entries && entries.length > 0 && (
                <>
                  <h3 className="costs-section-title">Entries</h3>
                  <div className="costs-table-wrapper">
                    <table className="costs-table">
                      <thead>
                        <tr>
                          <th>Key</th>
                          <th>Status</th>
                          <th className="costs-num">Runs</th>
                          <th>Last run</th>
                          <th className="costs-num">Cost</th>
                          <th>Share</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map((entry) => {
                          const share =
                            job.totalCost > 0
                              ? Math.min(1, entry.totalCost / job.totalCost)
                              : 0;
                          const active = entry.id === entryFilter;
                          const select = () =>
                            setEntryFilter(active ? null : entry.id);
                          return (
                            <tr
                              key={entry.id}
                              className={`costs-row ${active ? "costs-row--selected" : ""}`}
                              tabIndex={0}
                              onClick={select}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") select();
                              }}
                              aria-selected={active}
                            >
                              <td className="costs-model" title={entry.key}>
                                {entry.key}
                              </td>
                              <td className="costs-muted">{entry.status}</td>
                              <td className="costs-num">{entry.runs}</td>
                              <td>{formatDateTime(entry.lastRunAt)}</td>
                              <td className="costs-cost costs-num">
                                {formatCost(entry.totalCost)}
                              </td>
                              <td>
                                <div
                                  className="costs-share"
                                  title={`${(share * 100).toFixed(1)}%`}
                                >
                                  <div
                                    className="costs-share__bar"
                                    style={{ width: `${share * 100}%` }}
                                  />
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              <h3 className="costs-section-title">
                Runs
                {selectedEntry && (
                  <>
                    {" "}
                    of <code>{selectedEntry.key}</code>
                    <button
                      className="costs-link"
                      onClick={() => setEntryFilter(null)}
                    >
                      Show all runs
                    </button>
                  </>
                )}
              </h3>
              <div className="costs-table-wrapper">
                <table className="costs-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      {isKnowledge && <th>Entry</th>}
                      <th>Kind</th>
                      <th>Time</th>
                      <th>Model(s)</th>
                      <th className="costs-num">Steps</th>
                      <th title="Input / cache read / cache write / output">
                        Tokens
                      </th>
                      <th>Source</th>
                      <th className="costs-num">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRuns.length === 0 && (
                      <tr>
                        <td colSpan={runColumns} className="costs-empty">
                          No runs recorded.
                        </td>
                      </tr>
                    )}
                    {visibleRuns.map(({ run, index: i }) => {
                      const hasPhases = run.phases.length > 0;
                      const open = expanded.has(i);
                      return (
                        <Fragment key={i}>
                          <tr
                            className={hasPhases ? "costs-row" : undefined}
                            onClick={hasPhases ? () => toggle(i) : undefined}
                            aria-expanded={hasPhases ? open : undefined}
                          >
                            <td>
                              {hasPhases && (
                                <span className="costs-caret">
                                  {open ? "▾" : "▸"}
                                </span>
                              )}
                              {i + 1}
                            </td>
                            {isKnowledge && (
                              <td className="costs-model">
                                {run.entry?.key ?? "—"}
                              </td>
                            )}
                            <td>{RUN_KIND_LABEL[run.runKind]}</td>
                            <td>{formatDateTime(run.at)}</td>
                            <td className="costs-model">{runModels(run)}</td>
                            <td className="costs-num">{run.steps ?? "—"}</td>
                            <td className="costs-tokens">
                              {formatTokens(run.tokens.input)} /{" "}
                              {formatTokens(run.tokens.cacheRead)} /{" "}
                              {formatTokens(run.tokens.cacheWrite)} /{" "}
                              {formatTokens(run.tokens.output)}
                            </td>
                            <td>
                              <span
                                className="costs-source"
                                title={SOURCE_TOOLTIP[run.costSource]}
                              >
                                {run.costSource}
                              </span>
                            </td>
                            <td className="costs-cost costs-num">
                              {formatCost(run.totalCost)}
                            </td>
                          </tr>
                          {hasPhases && open && (
                            <tr className="costs-phases-row">
                              <td colSpan={runColumns}>
                                <table className="costs-phases">
                                  <thead>
                                    <tr>
                                      <th>Phase</th>
                                      <th>Model</th>
                                      <th className="costs-num">Steps</th>
                                      <th className="costs-num">Cost</th>
                                      <th>Share</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {run.phases.map((p, j) => {
                                      const share =
                                        run.totalCost > 0
                                          ? Math.min(1, p.cost / run.totalCost)
                                          : 0;
                                      return (
                                        <tr key={j}>
                                          <td>{p.phase}</td>
                                          <td className="costs-model">
                                            {p.model
                                              ? shortModel(p.model)
                                              : "—"}
                                          </td>
                                          <td className="costs-num">
                                            {p.steps ?? "—"}
                                          </td>
                                          <td className="costs-cost costs-num">
                                            {formatCost(p.cost)}
                                          </td>
                                          <td>
                                            <div
                                              className="costs-share"
                                              title={`${(share * 100).toFixed(1)}%`}
                                            >
                                              <div
                                                className="costs-share__bar"
                                                style={{
                                                  width: `${share * 100}%`,
                                                }}
                                              />
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {router && (
                <>
                  <h3 className="costs-section-title">
                    Recorded by the LLM router:{" "}
                    {router.requests.toLocaleString()} requests,{" "}
                    {formatCost(router.costUsd)}
                  </h3>
                  {routerDiffers && (
                    <p className="costs-muted costs-note">
                      Differs from the job's recorded total because some runs
                      bypassed the router or ran before it was enabled.
                    </p>
                  )}
                  <div className="costs-table-wrapper">
                    <table className="costs-table">
                      <thead>
                        <tr>
                          <th>Agent</th>
                          <th>Task</th>
                          <th>Model</th>
                          <th className="costs-num">Requests</th>
                          <th className="costs-num">Cost</th>
                          <th className="costs-num">Cache read</th>
                        </tr>
                      </thead>
                      <tbody>
                        {router.segments.map((s, i) => {
                          const inputSide =
                            s.tokens.input +
                            s.tokens.cacheRead +
                            s.tokens.cacheWrite;
                          return (
                            <tr key={i}>
                              <td>{s.agentId}</td>
                              <td>{s.task ?? "—"}</td>
                              <td className="costs-model" title={s.actualModel}>
                                {shortModel(s.actualModel)}
                              </td>
                              <td className="costs-num">
                                {s.requests.toLocaleString()}
                              </td>
                              <td className="costs-cost costs-num">
                                {formatCost(s.costUsd)}
                              </td>
                              <td className="costs-num">
                                {inputSide > 0
                                  ? `${((s.tokens.cacheRead / inputSide) * 100).toFixed(0)}%`
                                  : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function runModels(run: JobCostRun): string {
  if (run.models.length > 0) return run.models.map(shortModel).join(", ");
  return run.model ? shortModel(run.model) : "—";
}
