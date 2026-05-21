import { useState, useEffect } from "react";
import { createJob, getJobTypes } from "../api/jobApi";
import type { DependentRepo, ReviewJobType } from "../types/job.types";
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
    reviewJobType: "",
    dependencyContext: "",
  });
  const [dependentRepos, setDependentRepos] = useState<DependentRepo[]>([]);
  const [jobTypes, setJobTypes] = useState<ReviewJobType[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getJobTypes().then(setJobTypes).catch(() => {});
  }, []);

  const addDependentRepo = () => {
    setDependentRepos((prev) => [
      ...prev,
      { githubOwner: "BMO-Prod", githubRepo: "", githubBranch: "master" },
    ]);
  };

  const updateDependentRepo = (
    index: number,
    field: keyof DependentRepo,
    value: string,
  ) => {
    setDependentRepos((prev) =>
      prev.map((repo, i) => (i === index ? { ...repo, [field]: value } : repo)),
    );
  };

  const removeDependentRepo = (index: number) => {
    setDependentRepos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const validDeps = dependentRepos.filter(
        (d) => d.githubOwner && d.githubRepo && d.githubBranch,
      );
      const result = await createJob({
        githubOwner: form.githubOwner,
        githubRepo: form.githubRepo,
        githubBranch: form.githubBranch,
        dedupKey: form.dedupKey || undefined,
        reviewJobType: form.reviewJobType || undefined,
        dependentRepos: validDeps.length > 0 ? validDeps : undefined,
        dependencyContext: form.dependencyContext || undefined,
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
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2 className="modal__title">Create Job</h2>
          <button className="modal__close" onClick={onClose}>
            ✕
          </button>
        </div>

        <form className="modal__body" onSubmit={handleSubmit}>
          <div className="create-job-grid">
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
              <label className="form-label">Review Job Type</label>
              <select
                className="form-input"
                value={form.reviewJobType}
                onChange={(e) =>
                  setForm((f) => ({ ...f, reviewJobType: e.target.value }))
                }
              >
                <option value="">Select a job type</option>
                {jobTypes.map((jt) => (
                  <option key={jt.id} value={jt.id}>
                    {jt.name}
                  </option>
                ))}
              </select>
            </div>
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

          <div className="create-job-section">
            <div className="create-job-section__header">
              <label className="form-label">
                Dependent Repositories{" "}
                <span className="form-optional">(optional)</span>
              </label>
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={addDependentRepo}
              >
                + Add Repo
              </button>
            </div>

            {dependentRepos.map((dep, i) => (
              <div key={i} className="dep-repo-row">
                <input
                  className="form-input"
                  placeholder="Owner"
                  value={dep.githubOwner}
                  onChange={(e) =>
                    updateDependentRepo(i, "githubOwner", e.target.value)
                  }
                />
                <input
                  className="form-input"
                  placeholder="Repository"
                  value={dep.githubRepo}
                  onChange={(e) =>
                    updateDependentRepo(i, "githubRepo", e.target.value)
                  }
                />
                <input
                  className="form-input"
                  placeholder="Branch"
                  value={dep.githubBranch}
                  onChange={(e) =>
                    updateDependentRepo(i, "githubBranch", e.target.value)
                  }
                />
                <button
                  type="button"
                  className="btn btn--danger btn--sm"
                  onClick={() => removeDependentRepo(i)}
                >
                  ✕
                </button>
              </div>
            ))}

            {dependentRepos.length > 0 && (
              <div className="form-field" style={{ marginTop: 12 }}>
                <label className="form-label">
                  Dependency Context{" "}
                  <span className="form-optional">(optional)</span>
                </label>
                <textarea
                  className="form-input form-textarea"
                  placeholder="Describe the relationship between repos..."
                  value={form.dependencyContext}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      dependencyContext: e.target.value,
                    }))
                  }
                  rows={3}
                />
              </div>
            )}
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
