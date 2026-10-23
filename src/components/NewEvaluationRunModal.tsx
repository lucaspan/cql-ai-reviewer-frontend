import { useState } from "react";
import type {
  DatasetSummary,
  EvaluatedStage,
  StartRunParams,
} from "../types/job.types";
import "./Modal.css";
import "./EvaluationModals.css";

const ALL_STAGES: EvaluatedStage[] = [
  "endpoint_inventory",
  "threat_map",
  "security_scan",
  "scan_summary",
];

const MODEL_ROLES = [
  "piModel",
  "inventoryModel",
  "reviewModel",
  "summaryModel",
] as const;

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
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  const toggleStage = (stage: EvaluatedStage) => {
    setStages((current) =>
      current.includes(stage)
        ? current.filter((item) => item !== stage)
        : [...current, stage],
    );
  };

  const submit = () => {
    const modelOverrides = Object.fromEntries(
      Object.entries(overrides).filter(([, value]) => value.trim()),
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
    <div className="modal-overlay" onClick={onClose}>
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
                <label key={stage} className="eval-chip">
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
              Agents running at once within a stage. Each one clones a repo and
              runs its own agent, so raising this multiplies CPU, disk and
              rate-limit pressure.
            </span>
          </label>

          <fieldset className="eval-field">
            <legend>Model overrides</legend>
            <p className="eval-hint">
              Leave blank to use the global routing setting. Overrides apply to
              this run only.
            </p>
            {MODEL_ROLES.map((role) => (
              <label key={role} className="eval-field eval-field--inline">
                <span>{role}</span>
                <input
                  value={overrides[role] ?? ""}
                  placeholder="inherit"
                  onChange={(event) =>
                    setOverrides((current) => ({
                      ...current,
                      [role]: event.target.value,
                    }))
                  }
                />
              </label>
            ))}
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
