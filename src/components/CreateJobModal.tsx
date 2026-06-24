import { useState, useEffect } from "react";
import { createJob, createJobFromZip, getJobTypes } from "../api/jobApi";
import type { DependentRepo, ReviewJobType } from "../types/job.types";
import "./Modal.css";
import "./CreateJobModal.css";

type SourceMode = "github" | "zip";

interface InitialJobData {
  githubOwner?: string;
  githubRepo?: string;
  githubBranch?: string;
  reviewJobType?: string | null;
  dependentRepos?: DependentRepo[];
}

interface CreateJobModalProps {
  onClose: () => void;
  onCreated: (jobId?: string) => void;
  onError: (msg: string) => void;
  initialData?: InitialJobData;
}

export default function CreateJobModal({
  onClose,
  onCreated,
  onError,
  initialData,
}: CreateJobModalProps) {
  const [form, setForm] = useState({
    githubOwner: initialData?.githubOwner ?? "BMO-Prod",
    githubRepo: initialData?.githubRepo ?? "",
    githubBranch: initialData?.githubBranch ?? "master",
    dedupKey: "",
    reviewJobType: initialData?.reviewJobType ?? "",
  });
  const [dependentRepos, setDependentRepos] = useState<DependentRepo[]>(
    initialData?.dependentRepos ?? [],
  );
  const [jobTypes, setJobTypes] = useState<ReviewJobType[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [sourceMode, setSourceMode] = useState<SourceMode>("github");
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [zipCommit, setZipCommit] = useState("");

  useEffect(() => {
    getJobTypes().then(setJobTypes).catch(() => {});
  }, []);

  const addDependentRepo = () => {
    setDependentRepos((prev) => [
      ...prev,
      { githubOwner: "BMO-Prod", githubRepo: "", githubBranch: "master", dependencyContext: "" },
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
    if (sourceMode === "zip" && !zipFile) {
      onError("Please choose a .zip file to upload");
      return;
    }
    setSubmitting(true);
    try {
      let result;
      if (sourceMode === "zip") {
        result = await createJobFromZip({
          githubOwner: form.githubOwner,
          githubRepo: form.githubRepo,
          githubBranch: form.githubBranch,
          reviewJobType: form.reviewJobType || undefined,
          commitHash: zipCommit.trim() || undefined,
          file: zipFile!,
        });
      } else {
        const validDeps = dependentRepos.filter(
          (d) => d.githubOwner && d.githubRepo && d.githubBranch,
        );
        result = await createJob({
          githubOwner: form.githubOwner,
          githubRepo: form.githubRepo,
          githubBranch: form.githubBranch,
          dedupKey: form.dedupKey || undefined,
          reviewJobType: form.reviewJobType || undefined,
          dependentRepos: validDeps.length > 0 ? validDeps : undefined,
        });
      }
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
          <div className="form-field">
            <label className="form-label">Source</label>
            <div className="batch-job-types">
              <label className="batch-job-type-chip">
                <input
                  type="radio"
                  name="sourceMode"
                  checked={sourceMode === "github"}
                  onChange={() => setSourceMode("github")}
                />
                <span>Clone from GitHub</span>
              </label>
              <label className="batch-job-type-chip">
                <input
                  type="radio"
                  name="sourceMode"
                  checked={sourceMode === "zip"}
                  onChange={() => setSourceMode("zip")}
                />
                <span>Upload .zip</span>
              </label>
            </div>
            {sourceMode === "zip" && (
              <p className="form-optional" style={{ marginTop: 6 }}>
                For repos the GitHub token can't access. Owner/repo/branch are used as
                labels (the page still groups with that repo). Reviewed in full-repo
                mode and started immediately.
              </p>
            )}
          </div>

          {sourceMode === "zip" && (
            <>
              <div className="form-field">
                <label className="form-label">Source .zip *</label>
                <div className="file-picker">
                  <label className="btn btn--secondary btn--sm file-picker__btn">
                    Choose file
                    <input
                      type="file"
                      accept=".zip"
                      className="file-picker__input"
                      onChange={(e) => setZipFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                  <span className="file-picker__name">
                    {zipFile
                      ? `${zipFile.name} (${(zipFile.size / 1024 / 1024).toFixed(1)} MB)`
                      : "No file chosen"}
                  </span>
                </div>
              </div>

              <div className="form-field">
                <label className="form-label">
                  Commit Hash <span className="form-optional">(optional)</span>
                </label>
                <input
                  className="form-input"
                  placeholder="e.g. a1b2c3d (recorded for traceability)"
                  value={zipCommit}
                  onChange={(e) => setZipCommit(e.target.value)}
                />
              </div>
            </>
          )}

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

          {sourceMode === "github" && (
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
          )}

          {sourceMode === "github" && (
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
                <input
                  className="form-input"
                  placeholder="Context (e.g. shared auth lib)"
                  value={dep.dependencyContext ?? ""}
                  onChange={(e) =>
                    updateDependentRepo(i, "dependencyContext", e.target.value)
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
          </div>
          )}

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
