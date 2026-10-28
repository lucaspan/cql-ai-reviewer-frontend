import { useEffect, useState } from "react";
import { getLlmWorkloads } from "../api/jobApi";
import type {
  DatasetSummary,
  EvaluatedStage,
  StartRunParams,
} from "../types/job.types";
import type { LlmModel, LlmWorkload, RouterOverride } from "../types/llm.types";
import "./Modal.css";
import "./EvaluationModals.css";

const ALL_STAGES: EvaluatedStage[] = ["endpoint_inventory", "threat_map", "security_analysis"];

/** The router workloads each stage runs (the backend's STAGE_WORKLOADS). */
const STAGE_WORKLOADS: Record<EvaluatedStage, string[]> = {
  endpoint_inventory: ["endpoint_inventory"],
  threat_map: ["threat_map"],
  security_analysis: [
    "security_scan",
    "security_review_plan",
    "security_review",
    "security_verify",
    "scan_summary",
  ],
};

const STAGE_HINTS: Record<EvaluatedStage, string> = {
  endpoint_inventory: "Endpoint inventories from the repo profiles",
  threat_map: "The threat map from the golden inventories",
  security_analysis:
    "Per-flow scans, security review, gap analysis and the findings summary, on the golden threat map; scored on the findings list",
};

/** Workloads an evaluation run can override: the ones its stages run, and the judge's. */
const JUDGE_TASK = "eval_judge";

const DEFAULT_CONCURRENCY = 3;
const MAX_CONCURRENCY = 10;

interface Props {
  datasets: DatasetSummary[];
  onClose: () => void;
  onSubmit: (params: StartRunParams) => void;
}

export default function NewEvaluationRunModal({
  datasets,
  onClose,
  onSubmit,
}: Props) {
  const [datasetId, setDatasetId] = useState(datasets[0]?.id ?? "");
  const [label, setLabel] = useState("");
  const [stages, setStages] = useState<EvaluatedStage[]>(ALL_STAGES);
  const [concurrency, setConcurrency] = useState(DEFAULT_CONCURRENCY);
  const [overrides, setOverrides] = useState<Record<string, RouterOverride>>({});
  const [workloads, setWorkloads] = useState<LlmWorkload[]>([]);
  const [models, setModels] = useState<LlmModel[]>([]);
  const [modelsError, setModelsError] = useState<string | null>(null);

  useEffect(() => {
    getLlmWorkloads()
      .then((data) => {
        setWorkloads(data.workloads);
        setModels(data.models);
      })
      .catch((err: Error) => setModelsError(err.message));
  }, []);

  const labelOf = (id: string | null) =>
    id ? (models.find((m) => m.id === id)?.label ?? id) : "—";
  const currentModel = (task: string): string => {
    const w = workloads.find((x) => x.task === task);
    if (!w) return "policy";
    return w.mode === "fixed"
      ? `${labelOf(w.model)}${w.effort ? ` (${w.effort})` : ""}`
      : `${w.mode}: ${w.tiers.map((t) => labelOf(t.model)).join(" / ")}`;
  };
  const overridable = [
    ...ALL_STAGES.filter((s) => stages.includes(s)).flatMap((s) => STAGE_WORKLOADS[s]),
    JUDGE_TASK,
  ];

  const setOverride = (task: string, override: RouterOverride | null) =>
    setOverrides((current) => {
      const next = { ...current };
      if (override) next[task] = override;
      else delete next[task];
      return next;
    });

  const toggleStage = (stage: EvaluatedStage) => {
    setStages((current) =>
      current.includes(stage)
        ? current.filter((item) => item !== stage)
        : [...current, stage],
    );
  };

  const submit = () => {
    // Only the stages that run, and the judge
    const modelOverrides = Object.fromEntries(
      Object.entries(overrides).filter(([task]) => overridable.includes(task)),
    );
    onSubmit({
      datasetId,
      label: label.trim() || undefined,
      stages: stages.length === ALL_STAGES.length ? undefined : stages,
      concurrency,
      modelOverrides: Object.keys(modelOverrides).length
        ? modelOverrides
        : undefined,
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal eval-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal__header">
          <h2>New Evaluation Run</h2>
          <button className="modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="modal__body eval-modal__body">
          <label className="eval-field">
            <span>Dataset</span>
            <select
              value={datasetId}
              onChange={(event) => setDatasetId(event.target.value)}
            >
              {datasets.map((dataset) => (
                <option key={dataset.id} value={dataset.id}>
                  {dataset.id} — {dataset.projectName}
                </option>
              ))}
            </select>
          </label>

          <label className="eval-field">
            <span>Label</span>
            <input
              value={label}
              placeholder="e.g. opus-4.8 baseline"
              onChange={(event) => setLabel(event.target.value)}
            />
          </label>

          <fieldset className="eval-field">
            <legend>Stages</legend>
            <div className="eval-chips">
              {ALL_STAGES.map((stage) => (
                <label key={stage} className="eval-chip" title={STAGE_HINTS[stage]}>
                  <input
                    type="checkbox"
                    checked={stages.includes(stage)}
                    onChange={() => toggleStage(stage)}
                  />
                  <span>{stage.replace(/_/g, " ")}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="eval-field">
            <span>Concurrency</span>
            <input
              type="number"
              min={1}
              max={MAX_CONCURRENCY}
              value={concurrency}
              onChange={(event) =>
                setConcurrency(
                  Math.min(
                    MAX_CONCURRENCY,
                    Math.max(
                      1,
                      Number(event.target.value) || DEFAULT_CONCURRENCY,
                    ),
                  ),
                )
              }
            />
            <span className="eval-hint">
              Collections started at once within a stage (for security analysis,
              its per-flow scans). Each one clones a repo and runs its own agent;
              the server's Agents at once setting still caps the total. The
              security analysis runs the whole pipeline, so it is the slow and
              costly stage.
            </span>
          </label>

          <fieldset className="eval-field">
            <legend>Model overrides</legend>
            <p className="eval-hint">
              Models for this run only; the production policies (Settings → Models)
              are not changed. "Policy" uses the workload's current policy.
            </p>
            {modelsError && <p className="eval-hint">Could not load models: {modelsError}</p>}
            {overridable.map((task) => {
              const override = overrides[task];
              const levels = models.find((m) => m.id === override?.model)?.effortLevels ?? [];
              const label =
                task === JUDGE_TASK
                  ? "judge"
                  : (workloads.find((w) => w.task === task)?.label ?? task.replace(/_/g, " "));
              return (
                <label key={task} className="eval-field eval-field--inline">
                  <span>{label}</span>
                  <select
                    value={override?.model ?? ""}
                    onChange={(event) =>
                      setOverride(task, event.target.value ? { model: event.target.value } : null)
                    }
                  >
                    <option value="">Policy — {currentModel(task)}</option>
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  {override && levels.length > 0 && (
                    <select
                      value={override.effort ?? ""}
                      onChange={(event) =>
                        setOverride(task, {
                          model: override.model,
                          ...(event.target.value ? { effort: event.target.value } : {}),
                        })
                      }
                    >
                      <option value="">default effort</option>
                      {levels.map((level) => (
                        <option key={level} value={level}>
                          {level}
                        </option>
                      ))}
                    </select>
                  )}
                </label>
              );
            })}
          </fieldset>
        </div>

        <footer className="modal__footer">
          <button className="eval-btn eval-btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="eval-btn"
            disabled={!datasetId || stages.length === 0}
            onClick={submit}
          >
            Start Run
          </button>
        </footer>
      </div>
    </div>
  );
}
