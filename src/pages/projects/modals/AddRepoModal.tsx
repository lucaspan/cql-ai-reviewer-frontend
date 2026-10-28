import { useState, useEffect } from "react";
import {
  addProjectRepo,
} from "../../../api/jobApi";

export function AddRepoModal({
  projectId,
  onClose,
  onAdded,
}: {
  projectId: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [form, setForm] = useState({
    githubOwner: "BMO-Prod",
    githubRepo: "",
    githubBranch: "master",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [submitting, onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.githubRepo.trim()) return;
    setSubmitting(true);
    try {
      await addProjectRepo(projectId, {
        githubOwner: form.githubOwner.trim(),
        githubRepo: form.githubRepo.trim(),
        githubBranch: form.githubBranch.trim() || "master",
      });
      onAdded();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={() => !submitting && onClose()}>
      <div className="modal modal--sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <div>
            <h2 className="modal__title">Add Repository</h2>
            <p className="modal__subtitle">A peer repository in this system.</p>
          </div>
          <button
            className="modal__close"
            onClick={onClose}
            type="button"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <form className="modal__body" onSubmit={submit}>
          <div className="pj-form-grid">
            <div className="form-field">
              <label className="form-label">Owner</label>
              <input
                className="form-input"
                value={form.githubOwner}
                onChange={(e) =>
                  setForm((f) => ({ ...f, githubOwner: e.target.value }))
                }
                required
              />
            </div>
            <div className="form-field">
              <label className="form-label">Repo</label>
              <input
                className="form-input"
                value={form.githubRepo}
                onChange={(e) =>
                  setForm((f) => ({ ...f, githubRepo: e.target.value }))
                }
                placeholder="repository-name"
                autoFocus
                required
              />
            </div>
            <div className="form-field">
              <label className="form-label">Branch</label>
              <input
                className="form-input"
                value={form.githubBranch}
                onChange={(e) =>
                  setForm((f) => ({ ...f, githubBranch: e.target.value }))
                }
              />
            </div>
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
              disabled={submitting || !form.githubRepo.trim()}
            >
              {submitting ? "Adding…" : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
