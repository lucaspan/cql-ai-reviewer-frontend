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
  getProjectKnowledge,
  createRepoProfileEntries,
  createThreatMapEntry,
  startKnowledgeCollection,
  deleteProjectKnowledge,
  getKnowledgeActivity,
  getKnowledgeHistory,
} from "../api/jobApi";
import type {
  Project,
  ProjectRepo,
  ProjectRun,
  ProjectRunStatus,
  ProjectKnowledge,
  ProjectKnowledgeStatus,
  ProjectKnowledgeActivity,
  ProjectKnowledgeHistory,
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
  const [knowledge, setKnowledge] = useState<ProjectKnowledge[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingRepo, setAddingRepo] = useState(false);
  const [running, setRunning] = useState(false);
  const [generatingProfiles, setGeneratingProfiles] = useState(false);
  const [viewingKnowledgeId, setViewingKnowledgeId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [p, r, k] = await Promise.all([
        getProject(projectId),
        getProjectRuns(projectId),
        getProjectKnowledge(projectId),
      ]);
      setProject(p);
      setRuns(r);
      setKnowledge(k);
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
            className="btn btn--secondary btn--sm"
            onClick={refresh}
            title="Refresh project data"
          >
            ↻ Refresh
          </button>
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

      {/* Knowledge Base */}
      <section className="pj-section">
        <div className="pj-section__head">
          <h3 className="pj-section__title">Knowledge Base</h3>
          <button
            className="btn btn--secondary btn--sm"
            onClick={async () => {
              setGeneratingProfiles(true);
              try {
                await createRepoProfileEntries(projectId);
                await refresh();
              } finally {
                setGeneratingProfiles(false);
              }
            }}
            disabled={generatingProfiles || repos.length === 0}
          >
            {generatingProfiles ? "Creating…" : "Add Repo Profiles"}
          </button>
          <button
            className="btn btn--secondary btn--sm"
            onClick={async () => {
              await createThreatMapEntry(projectId);
              await refresh();
            }}
            disabled={repos.length === 0}
          >
            Add Threat Map
          </button>
        </div>
        {knowledge.length === 0 ? (
          <div className="pj-inline-empty">
            No knowledge yet. Click <strong>Generate Repo Profiles</strong> to start.
          </div>
        ) : (
          <div className="pj-table-wrapper">
            <table className="pj-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Key</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Ver</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {knowledge.map((k) => (
                  <tr key={k.id}>
                    <td><span className="pj-pill">{k.knowledgeType}</span></td>
                    <td className="pj-mono">{k.key}</td>
                    <td>{k.source}</td>
                    <td><KnowledgeStatusBadge status={k.status} error={k.error} /></td>
                    <td>{k.version}</td>
                    <td className="pj-actions-cell">
                      {(k.status === "pending" || k.status === "failed") && (
                        <button
                          className="btn btn--primary btn--sm"
                          onClick={async () => {
                            await startKnowledgeCollection(projectId, k.id);
                            refresh();
                          }}
                          aria-label={`Start ${k.key}`}
                        >
                          Start
                        </button>
                      )}
                      {k.status === "active" && (
                        <button
                          className="btn btn--primary btn--sm"
                          onClick={async () => {
                            await startKnowledgeCollection(projectId, k.id);
                            refresh();
                          }}
                          aria-label={`Regenerate ${k.key}`}
                        >
                          Regenerate
                        </button>
                      )}
                      <button
                        className="btn btn--secondary btn--sm"
                        onClick={() => setViewingKnowledgeId(k.id)}
                        aria-label={`View ${k.key}`}
                      >
                        View
                      </button>
                      <button
                        className="btn btn--danger btn--sm"
                        onClick={async () => {
                          await deleteProjectKnowledge(projectId, k.id);
                          refresh();
                        }}
                        aria-label={`Delete ${k.key}`}
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

      {viewingKnowledgeId && (
        <KnowledgeDetailModal
          projectId={projectId}
          knowledgeId={viewingKnowledgeId}
          knowledge={knowledge.find((k) => k.id === viewingKnowledgeId) ?? null}
          onClose={() => setViewingKnowledgeId(null)}
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

function KnowledgeStatusBadge({ status, error }: { status: ProjectKnowledgeStatus; error: string | null }) {
  const cls: Record<ProjectKnowledgeStatus, string> = {
    pending: "pj-status--pending",
    collecting: "pj-status--progress",
    active: "pj-status--done",
    failed: "pj-status--failed",
  };
  const label: Record<ProjectKnowledgeStatus, string> = {
    pending: "Pending",
    collecting: "Collecting",
    active: "Active",
    failed: "Failed",
  };
  return (
    <span className={`pj-status pj-status--sm ${cls[status]}`} title={error ?? undefined}>
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

// ---------------------------------------------------------------------------

function KnowledgeDetailModal({
  projectId,
  knowledgeId,
  knowledge,
  onClose,
}: {
  projectId: string;
  knowledgeId: string;
  knowledge: ProjectKnowledge | null;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"value" | "activity" | "history">("value");
  const [activity, setActivity] = useState<ProjectKnowledgeActivity[]>([]);
  const [history, setHistory] = useState<ProjectKnowledgeHistory[]>([]);
  const [loading, setLoading] = useState(false);

  const loadTab = useCallback(async (t: "value" | "activity" | "history") => {
    if (t === "value") return;
    setLoading(true);
    try {
      if (t === "activity") {
        setActivity(await getKnowledgeActivity(projectId, knowledgeId));
      } else {
        setHistory(await getKnowledgeHistory(projectId, knowledgeId));
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, knowledgeId]);

  useEffect(() => { loadTab(tab); }, [tab, loadTab]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <div>
            <h2 className="modal__title">Knowledge Detail</h2>
            <p className="modal__subtitle">
              {knowledge?.key ?? knowledgeId.slice(0, 8)}
              {knowledge && (
                <> &middot; v{knowledge.version} &middot; <KnowledgeStatusBadge status={knowledge.status} error={knowledge.error} /></>
              )}
            </p>
          </div>
          <button className="modal__close" onClick={onClose} type="button" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="pj-tabs">
          {(["value", "activity", "history"] as const).map((t) => (
            <button
              key={t}
              className={`pj-tab ${tab === t ? "pj-tab--active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t === "value" ? "Current Value" : t === "activity" ? "Activity Log" : "Version History"}
            </button>
          ))}
        </div>

        <div className="modal__body">
          {tab === "value" && knowledge && (
            <div className="pj-knowledge-value">
              {knowledge.error && (
                <div className="pj-run__error">{knowledge.error}</div>
              )}
              <pre className="pj-json">{JSON.stringify(knowledge.value, null, 2)}</pre>
            </div>
          )}

          {tab === "activity" && (
            loading ? <div className="pj-state">Loading...</div> : (
              activity.length === 0 ? (
                <div className="pj-inline-empty">No activity yet.</div>
              ) : (
                <div className="activity-list">
                  {[...activity].reverse().map((a, i) => (
                    <div key={a.id ?? i} className="activity-item">
                      <div className="activity-item__header">
                        <span className="pj-pill">{a.action}</span>
                        <span className="activity-item__time">
                          v{a.version} &middot; {new Date(a.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="activity-item__message">{a.message}</p>
                      {a.metadata && (
                        <pre className="activity-item__metadata">
                          {JSON.stringify(a.metadata, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              )
            )
          )}

          {tab === "history" && (
            loading ? <div className="pj-state">Loading...</div> : (
              history.length === 0 ? (
                <div className="pj-inline-empty">No previous versions.</div>
              ) : (
                <div className="pj-history-list">
                  {history.map((h) => (
                    <div key={h.id} className="pj-history-item">
                      <div className="pj-history-item__head">
                        <span className="pj-pill">v{h.version}</span>
                        <span className="pj-muted">{h.source}</span>
                        <span className="pj-muted">{new Date(h.createdAt).toLocaleString()}</span>
                      </div>
                      {h.metrics && (
                        <div className="pj-metrics">
                          <span>Model: {h.metrics.model}</span>
                          <span>In: {h.metrics.inputTokens.toLocaleString()}</span>
                          <span>Out: {h.metrics.outputTokens.toLocaleString()}</span>
                          <span>Cache R/W: {h.metrics.cacheReadTokens.toLocaleString()}/{h.metrics.cacheWriteTokens.toLocaleString()}</span>
                          <span>Steps: {h.metrics.steps}</span>
                          <span>Cost: ${h.metrics.totalCost.toFixed(4)}</span>
                          <span>{(h.metrics.durationMs / 1000).toFixed(1)}s</span>
                        </div>
                      )}
                      <details>
                        <summary>Value</summary>
                        <pre className="pj-json">{JSON.stringify(h.value, null, 2)}</pre>
                      </details>
                    </div>
                  ))}
                </div>
              )
            )
          )}
        </div>
      </div>
    </div>
  );
}
