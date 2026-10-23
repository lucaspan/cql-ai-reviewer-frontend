import { useCallback, useEffect, useState } from "react";
import {
  captureDataset,
  compareEvaluationRuns,
  getDatasetPatch,
  getDatasets,
  getEvaluationRun,
  getEvaluationRuns,
  getProjects,
  startEvaluationRun,
} from "../api/jobApi";
import type {
  DatasetSummary,
  EvaluationComparison,
  EvaluationRun,
  EvaluationRunDetail,
  PaginationMeta,
  Project,
} from "../types/job.types";
import Pagination from "../components/Pagination";
import NewEvaluationRunModal from "../components/NewEvaluationRunModal";
import CaptureDatasetModal from "../components/CaptureDatasetModal";
import type { CaptureParams } from "../components/CaptureDatasetModal";
import EvaluationRunDetailPanel from "../components/EvaluationRunDetailPanel";
import EvaluationComparePanel from "../components/EvaluationComparePanel";
import "./EvaluationsPage.css";

const ACTIVE_STATUSES = ["pending", "running"];
const POLL_INTERVAL_MS = 10_000;

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

function formatCost(value: number | null | undefined): string {
  if (!value) return "$0.00";
  return `$${value.toFixed(2)}`;
}

function formatDuration(ms: number | null | undefined): string {
  if (!ms) return "—";
  const minutes = Math.round(ms / 60_000);
  return minutes < 60
    ? `${minutes}m`
    : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export default function EvaluationsPage() {
  const [datasets, setDatasets] = useState<DatasetSummary[]>([]);
  const [runs, setRuns] = useState<EvaluationRun[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [datasetFilter, setDatasetFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const [showNewRun, setShowNewRun] = useState(false);
  const [showCapture, setShowCapture] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [capturing, setCapturing] = useState(false);
  const [detail, setDetail] = useState<EvaluationRunDetail | null>(null);
  const [comparison, setComparison] = useState<EvaluationComparison | null>(
    null,
  );
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);

  const loadRuns = useCallback(async () => {
    try {
      const result = await getEvaluationRuns(datasetFilter || undefined, {
        page,
        limit,
      });
      setRuns(result.data);
      setMeta(result.pagination);
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Failed to load runs");
    } finally {
      setLoading(false);
    }
  }, [datasetFilter, page, limit]);

  useEffect(() => {
    getDatasets()
      .then(setDatasets)
      .catch((err) =>
        setToast(
          err instanceof Error ? err.message : "Failed to load datasets",
        ),
      );
    getProjects()
      .then(setProjects)
      .catch(() => setProjects([]));
  }, []);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  // Runs take hours, so the table refreshes itself only while something is in flight.
  useEffect(() => {
    if (!runs.some((run) => ACTIVE_STATUSES.includes(run.status))) return;
    const timer = setInterval(loadRuns, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [runs, loadRuns]);

  const toggleCompare = (runId: string) => {
    setSelectedForCompare((current) =>
      current.includes(runId)
        ? current.filter((id) => id !== runId)
        : [...current, runId].slice(-2),
    );
  };

  const handleCompare = async () => {
    if (selectedForCompare.length !== 2) return;
    try {
      const [base, target] = selectedForCompare;
      setComparison(await compareEvaluationRuns(base, target));
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Comparison failed");
    }
  };

  const handleOpenRun = async (runId: string) => {
    try {
      setDetail(await getEvaluationRun(runId));
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Failed to load run");
    }
  };

  const handleStartRun = async (
    params: Parameters<typeof startEvaluationRun>[0],
  ) => {
    try {
      await startEvaluationRun(params);
      setShowNewRun(false);
      setToast("Evaluation run started");
      await loadRuns();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Failed to start run");
    }
  };

  const handleCapture = async (params: CaptureParams) => {
    setCapturing(true);
    try {
      await captureDataset({
        ...params,
        flowSubset: params.flowSubset?.length ? params.flowSubset : undefined,
      });
      setShowCapture(false);
      setToast(
        `Dataset "${params.datasetId}" captured. Curate must-find findings, then commit it.`,
      );
      setDatasets(await getDatasets());
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Capture failed");
    } finally {
      setCapturing(false);
    }
  };

  // Datasets live in git, so promotion produces a downloadable patch for a reviewed PR
  // rather than writing to the manifest directly.
  const handleExportPatch = async (runId: string, itemKeys: string[]) => {
    try {
      const patch = await getDatasetPatch(runId, itemKeys);
      const blob = new Blob([JSON.stringify(patch, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `dataset-patch-${runId}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Failed to build patch");
    }
  };

  const stageSummary = (run: EvaluationRun) => {
    if (run.status === "failed") return run.error ?? "Failed";
    if (!run.totals) return "—";
    return formatPercent(run.totals.meanF1);
  };

  return (
    <div className="evaluations">
      {toast && (
        <div className="evaluations__toast" onClick={() => setToast(null)}>
          {toast}
        </div>
      )}

      <section className="evaluations__section">
        <div className="evaluations__section-head">
          <h2>Golden Datasets</h2>
          <div className="evaluations__actions">
            <button
              className="evaluations__btn evaluations__btn--ghost"
              disabled={!projects.length || capturing}
              onClick={() => setShowCapture(true)}
            >
              {capturing ? "Capturing…" : "Capture Dataset"}
            </button>
            <button
              className="evaluations__btn"
              disabled={!datasets.length}
              onClick={() => setShowNewRun(true)}
            >
              New Run
            </button>
          </div>
        </div>

        {datasets.length === 0 ? (
          <p className="evaluations__empty">
            No datasets yet. Capture one from a project whose knowledge
            collection has finished — that snapshot becomes the baseline every
            future run is scored against.
          </p>
        ) : (
          <div className="evaluations__cards">
            {datasets.map((dataset) => (
              <article key={dataset.id} className="evaluations__card">
                <h3>{dataset.id}</h3>
                <p className="evaluations__card-desc">{dataset.description}</p>
                <dl className="evaluations__card-meta">
                  <div>
                    <dt>Project</dt>
                    <dd>{dataset.projectName}</dd>
                  </div>
                  <div>
                    <dt>Dynatrace snapshot</dt>
                    <dd>
                      {new Date(
                        dataset.dynatraceCapturedAt,
                      ).toLocaleDateString()}{" "}
                      ({dataset.dynatraceTimeframe})
                    </dd>
                  </div>
                </dl>
                <ul className="evaluations__repos">
                  {dataset.repos.map((repo) => (
                    <li key={repo.repo}>
                      <span>{repo.repo}</span>
                      <code>{repo.commitSha.slice(0, 10)}</code>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="evaluations__section">
        <div className="evaluations__section-head">
          <h2>Runs</h2>
          <div className="evaluations__actions">
            <select
              value={datasetFilter}
              onChange={(event) => {
                setDatasetFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All datasets</option>
              {datasets.map((dataset) => (
                <option key={dataset.id} value={dataset.id}>
                  {dataset.id}
                </option>
              ))}
            </select>
            <button
              className="evaluations__btn"
              disabled={selectedForCompare.length !== 2}
              onClick={handleCompare}
            >
              Compare ({selectedForCompare.length}/2)
            </button>
          </div>
        </div>

        {loading ? (
          <p className="evaluations__empty">Loading…</p>
        ) : (
          <>
            <div className="evaluations__table-wrap">
              <table className="evaluations__table">
                <thead>
                  <tr>
                    <th />
                    <th>Run</th>
                    <th>Dataset</th>
                    <th>Status</th>
                    <th>Mean F1</th>
                    <th>Cost</th>
                    <th>Duration</th>
                    <th>Started</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => (
                    <tr key={run.id} onClick={() => handleOpenRun(run.id)}>
                      <td onClick={(event) => event.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedForCompare.includes(run.id)}
                          onChange={() => toggleCompare(run.id)}
                          aria-label={`Select run ${run.label ?? run.id} for comparison`}
                        />
                      </td>
                      <td>{run.label ?? run.id.slice(0, 8)}</td>
                      <td>{run.datasetId}</td>
                      <td>
                        <span
                          className={`evaluations__badge evaluations__badge--${run.status}`}
                        >
                          {run.status}
                        </span>
                      </td>
                      <td>{stageSummary(run)}</td>
                      <td>{formatCost(run.totals?.totalCost)}</td>
                      <td>{formatDuration(run.totals?.durationMs)}</td>
                      <td>{new Date(run.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                  {runs.length === 0 && (
                    <tr>
                      <td colSpan={10} className="evaluations__empty">
                        No runs yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              meta={meta}
              onPageChange={setPage}
              onLimitChange={(next) => {
                setLimit(next);
                setPage(1);
              }}
            />
          </>
        )}
      </section>

      {showNewRun && (
        <NewEvaluationRunModal
          datasets={datasets}
          onClose={() => setShowNewRun(false)}
          onSubmit={handleStartRun}
        />
      )}

      {showCapture && (
        <CaptureDatasetModal
          projects={projects}
          onClose={() => setShowCapture(false)}
          onSubmit={handleCapture}
        />
      )}

      {detail && (
        <EvaluationRunDetailPanel
          run={detail}
          onClose={() => setDetail(null)}
          onExportPatch={handleExportPatch}
        />
      )}

      {comparison && (
        <EvaluationComparePanel
          comparison={comparison}
          onClose={() => setComparison(null)}
        />
      )}
    </div>
  );
}
