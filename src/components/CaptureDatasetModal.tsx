import { useEffect, useState } from "react";
import { getProject, getProjectKnowledge } from "../api/jobApi";
import type { Project, ProjectKnowledge } from "../types/job.types";
import "./Modal.css";
import "./EvaluationModals.css";

/** Frozen upstream input. Without these the dataset cannot pin the Dynatrace-derived state. */
const REQUIRED_TYPES = ["service_mapping", "runtime_topology"];
/** Scored stages. A dataset with none of these has nothing to compare a run against. */
const EXPECTED_TYPES = [
  "endpoint_inventory",
  "threat_map",
  "security_scan",
  "scan_summary",
];

const DATASET_ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/i;

export interface CaptureParams {
  projectId: string;
  datasetId: string;
  description: string;
  flowSubset?: string[];
}

interface Props {
  projects: Project[];
  onClose: () => void;
  onSubmit: (params: CaptureParams) => void;
}

export default function CaptureDatasetModal({
  projects,
  onClose,
  onSubmit,
}: Props) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [datasetId, setDatasetId] = useState("");
  const [description, setDescription] = useState("");
  const [flowSubset, setFlowSubset] = useState("");
  const [project, setProject] = useState<Project | null>(null);
  const [knowledge, setKnowledge] = useState<ProjectKnowledge[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    setKnowledge(null);
    Promise.all([getProject(projectId), getProjectKnowledge(projectId)])
      .then(([loadedProject, loadedKnowledge]) => {
        setProject(loadedProject);
        setKnowledge(loadedKnowledge);
      })
      .catch(() => setKnowledge([]))
      .finally(() => setLoading(false));
  }, [projectId]);

  const activeTypes = new Set(
    (knowledge ?? [])
      .filter((entry) => entry.status === "active")
      .map((e) => e.knowledgeType),
  );
  const missingRequired = REQUIRED_TYPES.filter(
    (type) => !activeTypes.has(type),
  );
  const missingExpected = EXPECTED_TYPES.filter(
    (type) => !activeTypes.has(type),
  );

  const idValid = DATASET_ID_PATTERN.test(datasetId);
  const canSubmit = projectId && idValid && description.trim() && !loading;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal eval-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal__header">
          <h2>Capture Golden Dataset</h2>
          <button className="modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="modal__body eval-modal__body">
          <label className="eval-field">
            <span>Project</span>
            <select
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
            >
              {projects.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          {loading && <p className="eval-hint">Checking project knowledge…</p>}

          {knowledge !== null && !loading && (
            <>
              {missingRequired.length > 0 && (
                <p className="eval-error">
                  Missing active {missingRequired.join(" and ")}. These carry
                  the Dynatrace data the dataset needs to freeze — capture now
                  and runs will have no pinned runtime state. Collect them
                  first.
                </p>
              )}
              {missingRequired.length === 0 && missingExpected.length > 0 && (
                <p className="eval-hint eval-hint--warn">
                  No active {missingExpected.join(", ")}. Those stages will have
                  empty expectations and always score 0.
                </p>
              )}
              {missingRequired.length === 0 && missingExpected.length === 0 && (
                <p className="eval-hint">
                  All stages have active knowledge — good to capture.
                </p>
              )}

              {project?.repos?.length ? (
                <div className="eval-field">
                  <span>Repos to pin ({project.repos.length})</span>
                  <ul className="eval-items">
                    {project.repos.map((repo) => (
                      <li key={repo.id} className="eval-item">
                        <span className="eval-item__label">
                          {repo.githubOwner}/{repo.githubRepo}
                          <span className="eval-item__detail">
                            branch {repo.githubBranch} — current head will be
                            resolved and pinned
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="eval-error">This project has no repositories.</p>
              )}
            </>
          )}

          <label className="eval-field">
            <span>Dataset ID</span>
            <input
              value={datasetId}
              placeholder="launch-2026-10"
              onChange={(event) => setDatasetId(event.target.value)}
            />
            {datasetId && !idValid && (
              <span className="eval-hint eval-hint--warn">
                Letters, numbers, dot, dash and underscore only.
              </span>
            )}
          </label>

          <label className="eval-field">
            <span>Description</span>
            <input
              value={description}
              placeholder="LAU baseline, Opus 4.8"
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>

          <label className="eval-field">
            <span>Flow subset (optional)</span>
            <input
              value={flowSubset}
              placeholder="F001, F004, F007"
              onChange={(event) => setFlowSubset(event.target.value)}
            />
            <span className="eval-hint">
              Limits the security_scan fan-out. Leave blank to scan every data
              flow — accurate but slow and expensive.
            </span>
          </label>
        </div>

        <footer className="modal__footer">
          <span className="eval-hint">
            Writes a manifest to the repo for PR review.
          </span>
          <div className="eval-footer-actions">
            <button className="eval-btn eval-btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              className="eval-btn"
              disabled={!canSubmit}
              onClick={() =>
                onSubmit({
                  projectId,
                  datasetId: datasetId.trim(),
                  description: description.trim(),
                  flowSubset: flowSubset
                    .split(",")
                    .map((flow) => flow.trim())
                    .filter(Boolean),
                })
              }
            >
              Capture
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
