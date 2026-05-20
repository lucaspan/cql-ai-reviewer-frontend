import { useState } from "react";
import { followUpJob } from "../api/jobApi";
import "./Modal.css";
import "./CreateJobModal.css";

interface FollowUpModalProps {
  jobId: string;
  onClose: () => void;
  onDone: (newFindings: number) => void;
  onError: (msg: string) => void;
}

export default function FollowUpModal({
  jobId,
  onClose,
  onDone,
  onError,
}: FollowUpModalProps) {
  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setSubmitting(true);
    try {
      const result = await followUpJob(jobId, prompt.trim());
      if (result.processed) {
        onDone(result.newFindings ?? 0);
      } else {
        onError(result.error ?? "Follow-up failed");
      }
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal--sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <div>
            <h2 className="modal__title">Follow Up</h2>
            <p className="modal__subtitle">
              Send a follow-up prompt to the agent session
            </p>
          </div>
          <button className="modal__close" onClick={onClose}>
            ✕
          </button>
        </div>

        <form className="modal__body" onSubmit={handleSubmit}>
          <div className="form-field">
            <label className="form-label">Prompt *</label>
            <textarea
              className="form-input form-textarea"
              placeholder="e.g. Check for SQL injection vulnerabilities in the auth module"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={5}
              required
              autoFocus
            />
          </div>

          <div className="modal__footer">
            <button
              type="button"
              className="btn btn--secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={submitting || !prompt.trim()}
            >
              {submitting ? "Running..." : "Run Follow-Up"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
