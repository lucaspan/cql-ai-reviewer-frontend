import { useState } from "react";
import "./Modal.css";
import "./ProcessJobModal.css";

interface ProcessJobModalProps {
  jobId: string;
  onClose: () => void;
  onConfirm: (mode?: "diff" | "full-repo") => void;
  processing: boolean;
}

type ModeOption = "" | "diff" | "full-repo";

export default function ProcessJobModal({
  jobId,
  onClose,
  onConfirm,
  processing,
}: ProcessJobModalProps) {
  const [mode, setMode] = useState<ModeOption>("");

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal--sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <div>
            <h2 className="modal__title">Process Job</h2>
            <p className="modal__subtitle">
              <span className="process-job-id">{jobId}</span>
            </p>
          </div>
          <button className="modal__close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal__body">
          <div className="process-mode">
            <span className="process-mode__label">Select review mode</span>
            <div className="process-mode__options">
              {(
                [
                  {
                    value: "",
                    label: "Default",
                    desc: "Use the job's configured mode, reuses same-commit results if available",
                  },
                  {
                    value: "diff",
                    label: "Diff",
                    desc: "Review only changed files against the base branch",
                  },
                  {
                    value: "full-repo",
                    label: "Full Repo",
                    desc: "Review all files in the repository, bypasses result reuse",
                  },
                ] as { value: ModeOption; label: string; desc: string }[]
              ).map((opt) => (
                <label key={opt.value} className="process-mode__option">
                  <input
                    type="radio"
                    name="mode"
                    value={opt.value}
                    checked={mode === opt.value}
                    onChange={() => setMode(opt.value)}
                  />
                  <div className="process-mode__option-content">
                    <strong>{opt.label}</strong>
                    <span>{opt.desc}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="modal__footer">
            <button
              type="button"
              className="btn btn--secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--success"
              onClick={() => onConfirm(mode || undefined)}
              disabled={processing}
            >
              {processing ? "Processing..." : "▶ Process"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
