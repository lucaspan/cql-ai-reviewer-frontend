import { useState, useEffect, useCallback } from "react";
import {
  getProjects,
  createProject,
  deleteProject,
  getProject,
  addProjectRepo,
  removeProjectRepo,
  createProjectRun,
  processProjectRun,
  getProjectRuns,
} from "../api/jobApi";
import type {
  Project,
  ProjectRepo,
  ProjectRun,
  ProjectRunStatus,
} from "../types/job.types";
import "./ProjectsPage.css";
import "../components/Modal.css";

// Pipeline stages, in execution order. Phase 1 runs the lifecycle; Phase 2/3 fill
// these stages with real work (THREAT_MAP → map elements, SAST_VERDICT → findings).
const STAGE_LABELS: Record<string, string> = {
  THREAT_MAP: "Threat Map",
  SAST_VERDICT: "Verdicts",
};
const stageLabel = (s: string) => STAGE_LABELS[s] ?? s;

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setProjects(await getProjects());
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <div className="pj-state">Loading…</div>;
  }

  if (selectedId) {
    return (
      <ProjectDetail
        projectId={selectedId}
        onBack={() => {
          setSelectedId(null);
          load();
        }}
        onDeleted={() => {
          setSelectedId(null);
          load();
        }}
      />
    );
  }

  return (
    <div className="pj-content">
      <div className="pj-toolbar">
        <span className="pj-count">
          {projects.length} project{projects.length !== 1 ? "s" : ""}
        </span>
        <button className="btn btn--primary btn--sm" onClick={() => setCreating(true)}>
          + New Project
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="pj-empty-card">
          <h3>No projects yet</h3>
          <p>
            Group related repositories into a system, then run the threat-modeling
            pipeline across them.
          </p>
          <button className="btn btn--primary btn--sm" onClick={() => setCreating(true)}>
            + New Project
          </button>
        </div>
      ) : (
        <div className="pj-grid">
          {projects.map((p) => (
            <button key={p.id} className="pj-card" onClick={() => setSelectedId(p.id)}>
              <div className="pj-card__head">
                <span className="pj-card__name">{p.name}</span>
                <span
                  className={`pj-badge ${p.enabled ? "pj-badge--on" : "pj-badge--off"}`}
                >
                  {p.enabled ? "Enabled" : "Disabled"}
                </span>
              </div>
              {p.description && <p className="pj-card__desc">{p.description}</p>}
              <div className="pj-card__meta">
                {(p.repos?.length ?? 0)} repo{(p.repos?.length ?? 0) !== 1 ? "s" : ""}
              </div>
            </button>
          ))}
        </div>
      )}

      {creating && (
        <CreateProjectModal
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            load();
            setSelectedId(id);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function ProjectDetail({
  projectId,
  onBack,
  onDeleted,
}: {
  projectId: string;
  onBack: () => void;
  onDeleted: () => void;
}) {
  const [project, setProject] = useState<Project | null>(null);
  const [runs, setRuns] = useState<ProjectRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingRepo, setAddingRepo] = useState(false);
  const [running, setRunning] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [p, r] = await Promise.all([getProject(projectId), getProjectRuns(projectId)]);
      setProject(p);
      setRuns(r);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const repos = project?.repos ?? [];
  const canRun = repos.length > 0 && !running;

  const handleRun = async () => {
    setRunning(true);
    try {
      const run = await createProjectRun(projectId);
      // Kick off processing immediately (fire-and-forget on the server side).
      await processProjectRun(run.id).catch(() => {});
      await refresh();
    } catch {
      /* silent */
    } finally {
      setRunning(false);
    }
  };

  const handleRemoveRepo = async (repoId: string) => {
    await removeProjectRepo(projectId, repoId);
    refresh();
  };

  const handleDelete = async () => {
    if (!confirm("Delete this project and all its runs? This cannot be undone.")) return;
    await deleteProject(projectId);
    onDeleted();
  };

  if (loading) return <div className="pj-state">Loading…</div>;
  if (!project) return <div className="pj-state">Project not found.</div>;

  return (
    <div className="pj-content">
      <button className="pj-back" onClick={onBack}>
        ← All projects
      </button>

      <div className="pj-detail-head">
        <div>
          <h2 className="pj-detail-title">{project.name}</h2>
          {project.description && <p className="pj-detail-desc">{project.description}</p>}
        </div>
        <div className="pj-detail-actions">
          <button
            className="btn btn--primary btn--sm"
            onClick={handleRun}
            disabled={!canRun}
            title={repos.length === 0 ? "Add at least one repository first" : "Run the threat-modeling pipeline"}
          >
            {running ? "Starting…" : "Run Pipeline"}
          </button>
          <button className="btn btn--danger btn--sm" onClick={handleDelete}>
            Delete
          </button>
        </div>
      </div>

      {/* Repositories — flat peers */}
      <section className="pj-section">
        <div className="pj-section__head">
          <h3 className="pj-section__title">Repositories</h3>
          <button className="btn btn--secondary btn--sm" onClick={() => setAddingRepo(true)}>
            + Add Repo
          </button>
        </div>
        <p className="pj-hint">
          All repositories are analyzed together as one system — peers, not a hierarchy.
        </p>
        {repos.length === 0 ? (
          <div className="pj-inline-empty">No repositories yet.</div>
        ) : (
          <div className="pj-table-wrapper">
            <table className="pj-table">
              <thead>
                <tr>
                  <th>Owner</th>
                  <th>Repo</th>
                  <th>Branch</th>
                  <th>Role</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {repos.map((r: ProjectRepo) => (
                  <tr key={r.id}>
                    <td>{r.githubOwner}</td>
                    <td className="pj-mono">{r.githubRepo}</td>
                    <td>{r.githubBranch}</td>
                    <td>
                      {r.role ? (
                        <span className="pj-pill">{r.role}</span>
                      ) : (
                        <span className="pj-muted">—</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="btn btn--danger btn--sm"
                        onClick={() => handleRemoveRepo(r.id)}
                        aria-label={`Remove ${r.githubRepo}`}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Runs — each shows the sequential stage timeline */}
      <section className="pj-section">
        <div className="pj-section__head">
          <h3 className="pj-section__title">Runs</h3>
          <button
            className="btn btn--secondary btn--sm"
            onClick={refresh}
            title="Refresh run status"
          >
            Refresh
          </button>
        </div>
        {runs.length === 0 ? (
          <div className="pj-inline-empty">
            No runs yet. Click <strong>Run Pipeline</strong> to start.
          </div>
        ) : (
          <div className="pj-runs">
            {runs.map((run) => (
              <RunRow key={run.id} run={run} />
            ))}
          </div>
        )}
      </section>

      {addingRepo && (
        <AddRepoModal
          projectId={projectId}
          onClose={() => setAddingRepo(false)}
          onAdded={() => {
            setAddingRepo(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function RunRow({ run }: { run: ProjectRun }) {
  const stages = [...(run.stages ?? [])].sort((a, b) => a.ordinal - b.ordinal);
  return (
    <div className="pj-run">
      <div className="pj-run__head">
        <StatusBadge status={run.status} />
        <span className="pj-run__id">{run.id.slice(0, 8)}</span>
        <span className="pj-run__time">{new Date(run.createdAt).toLocaleString()}</span>
      </div>

      {/* Sequential stage timeline. Phase 2/3 will let a COMPLETED stage open its
          map elements / verdicts; for now it shows status only. */}
      <ol className="pj-timeline">
        {stages.map((stage, i) => (
          <li key={stage.id} className="pj-timeline__item">
            <span className={`pj-dot pj-dot--${stage.status.toLowerCase()}`} aria-hidden />
            <span className="pj-timeline__label">{stageLabel(stage.stage)}</span>
            <StatusBadge status={stage.status} small />
            {i < stages.length - 1 && <span className="pj-timeline__sep" aria-hidden />}
          </li>
        ))}
      </ol>

      {run.error && <div className="pj-run__error">{run.error}</div>}
    </div>
  );
}

function StatusBadge({ status, small }: { status: ProjectRunStatus; small?: boolean }) {
  const map: Record<ProjectRunStatus, string> = {
    PENDING: "pj-status--pending",
    IN_PROGRESS: "pj-status--progress",
    COMPLETED: "pj-status--done",
    FAILED: "pj-status--failed",
  };
  const label: Record<ProjectRunStatus, string> = {
    PENDING: "Pending",
    IN_PROGRESS: "Running",
    COMPLETED: "Completed",
    FAILED: "Failed",
  };
  return (
    <span className={`pj-status ${map[status]} ${small ? "pj-status--sm" : ""}`}>
      {label[status]}
    </span>
  );
}

// ---------------------------------------------------------------------------

function CreateProjectModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
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
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const p = await createProject({
        name: name.trim(),
        description: description.trim() || null,
      });
      onCreated(p.id);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={() => !submitting && onClose()}>
      <div className="modal modal--sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <div>
            <h2 className="modal__title">New Project</h2>
            <p className="modal__subtitle">A system of related repositories to threat-model.</p>
          </div>
          <button className="modal__close" onClick={onClose} type="button" aria-label="Close">
            ✕
          </button>
        </div>
        <form className="modal__body" onSubmit={submit}>
          <div className="form-field">
            <label className="form-label" htmlFor="pj-name">
              Name
            </label>
            <input
              id="pj-name"
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Payments Platform"
              autoFocus
              required
            />
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="pj-desc">
              Description <span className="form-optional">(architecture context)</span>
            </label>
            <textarea
              id="pj-desc"
              className="form-input pj-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="How these repos relate — frontend, backend, infra, shared libs…"
              rows={4}
            />
          </div>
          <div className="modal__footer">
            <button type="button" className="btn btn--secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={submitting || !name.trim()}>
              {submitting ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function AddRepoModal({
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
    role: "",
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
        role: form.role.trim() || null,
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
          <button className="modal__close" onClick={onClose} type="button" aria-label="Close">
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
                onChange={(e) => setForm((f) => ({ ...f, githubOwner: e.target.value }))}
                required
              />
            </div>
            <div className="form-field">
              <label className="form-label">Repo</label>
              <input
                className="form-input"
                value={form.githubRepo}
                onChange={(e) => setForm((f) => ({ ...f, githubRepo: e.target.value }))}
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
                onChange={(e) => setForm((f) => ({ ...f, githubBranch: e.target.value }))}
              />
            </div>
            <div className="form-field">
              <label className="form-label">
                Role <span className="form-optional">(tag)</span>
              </label>
              <input
                className="form-input"
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                placeholder="frontend / backend / infra"
              />
            </div>
          </div>
          <div className="modal__footer">
            <button type="button" className="btn btn--secondary" onClick={onClose} disabled={submitting}>
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
