import { useState } from "react";
import { createJob } from "../api/jobApi";
import "./Modal.css";
import "./CreateJobModal.css";

interface CreateJobModalProps {
  onClose: () => void;
  onCreated: (jobId?: string) => void;
  onError: (msg: string) => void;
}

export default function CreateJobModal({
  onClose,
  onCreated,
  onError,
}: CreateJobModalProps) {
  const [form, setForm] = useState({
    githubOwner: "BMO-Prod",
    githubRepo: "",
    githubBranch: "master",
    dedupKey: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const result = await createJob({
        githubOwner: form.githubOwner,
        githubRepo: form.githubRepo,
        githubBranch: form.githubBranch,
        dedupKey: form.dedupKey || undefined,
      });
      if (result.created) {
        onCreated(result.jobId);
      } else {
        onError(result.error ?? "Job creation failed");
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
          <h2 className="modal__title">Create Job</h2>
          <button className="modal__close" onClick={onClose}>
            ✕
          </button>
        </div>

        <form className="modal__body" onSubmit={handleSubmit}>
          <div className="form-field">
            <label className="form-label">GitHub Owner *</label>
            <input
              className="form-input"
              placeholder="e.g. BMO-Prod"
              value={form.githubOwner}
              onChange={(e) =>
                setForm((f) => ({ ...f, githubOwner: e.target.value }))
              }
              required
            />
          </div>

          <div className="form-field">
            <label className="form-label">Repository *</label>
            <input
              className="form-input"
              placeholder="e.g. BILJ_bilj-ui-shell-app_51362"
              value={form.githubRepo}
              onChange={(e) =>
                setForm((f) => ({ ...f, githubRepo: e.target.value }))
              }
              required
            />
          </div>

          <div className="form-field">
            <label className="form-label">Branch *</label>
            <input
              className="form-input"
              placeholder="e.g. develop-R45"
              value={form.githubBranch}
              onChange={(e) =>
                setForm((f) => ({ ...f, githubBranch: e.target.value }))
              }
              required
            />
          </div>

          <div className="form-field">
            <label className="form-label">
              Dedup Key <span className="form-optional">(optional)</span>
            </label>
            <input
              className="form-input"
              placeholder="Auto-generated if empty"
              value={form.dedupKey}
              onChange={(e) =>
                setForm((f) => ({ ...f, dedupKey: e.target.value }))
              }
            />
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
              type="submit"
              className="btn btn--primary"
              disabled={submitting}
            >
              {submitting ? "Creating..." : "Create Job"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
