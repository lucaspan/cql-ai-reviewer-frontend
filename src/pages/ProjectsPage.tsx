import { useState, useEffect, useCallback, useMemo } from "react";
import {
  getProjects,
  createProject,
  deleteProject,
  getProject,
  addProjectRepo,
  removeProjectRepo,
  getProjectKnowledge,
  createRepoProfileEntries,
  createThreatMapEntry,
  createSecurityScanEntries,
  startAllSecurityScans,
  createScanSummaryEntry,
  startKnowledgeCollection,
  resetProjectKnowledge,
  deleteProjectKnowledge,
  getProjectFindings,
  getProjectFindingStats,
  dismissProjectFinding,
  confirmProjectFinding,
  reopenProjectFinding,
  getKnowledgeActivity,
  getKnowledgeHistory,
} from "../api/jobApi";
import type {
  Project,
  ProjectRepo,
  ProjectKnowledge,
  ProjectKnowledgeStatus,
  ProjectKnowledgeActivity,
  ProjectKnowledgeHistory,
  ProjectFinding,
} from "../types/job.types";
import ThreatMapGraph from "../components/ThreatMapGraph";
import "./ProjectsPage.css";
import "../components/Modal.css";

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
  const [knowledge, setKnowledge] = useState<ProjectKnowledge[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingRepo, setAddingRepo] = useState(false);
  const [findings, setFindings] = useState<ProjectFinding[]>([]);
  const [findingStats, setFindingStats] = useState<Record<string, number>>({});
  const [generatingProfiles, setGeneratingProfiles] = useState(false);
  const [viewingKnowledgeId, setViewingKnowledgeId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [p, k, f, fs] = await Promise.all([
        getProject(projectId),
        getProjectKnowledge(projectId),
        getProjectFindings(projectId).catch(() => [] as ProjectFinding[]),
        getProjectFindingStats(projectId).catch(() => ({} as Record<string, number>)),
      ]);
      setProject(p);
      setKnowledge(k);
      setFindings(f);
      setFindingStats(fs);
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

  const handleRemoveRepo = async (repoId: string) => {
    await removeProjectRepo(projectId, repoId);
    refresh();
  };

  const handleDelete = async () => {
    if (!confirm("Delete this project? This cannot be undone.")) return;
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
        {knowledge.filter(k => k.knowledgeType !== "security_scan" && k.knowledgeType !== "scan_summary").length === 0 ? (
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
                {knowledge.filter(k => k.knowledgeType !== "security_scan" && k.knowledgeType !== "scan_summary").map((k) => (
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
                      {k.status === "collecting" && (
                        <button
                          className="btn btn--danger btn--sm"
                          onClick={async () => {
                            await resetProjectKnowledge(projectId, k.id);
                            refresh();
                          }}
                          aria-label={`Reset ${k.key}`}
                        >
                          Reset
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

      {/* Security Scans */}
      <section className="pj-section">
        <div className="pj-section__head">
          <h3 className="pj-section__title">Security Scans</h3>
          {knowledge.some(k => k.knowledgeType === "threat_map" && k.status === "active") && (
            <button
              className="btn btn--primary btn--sm"
              onClick={async () => {
                await createSecurityScanEntries(projectId);
                await refresh();
              }}
            >
              Create Threat Map Scans
            </button>
          )}
          {knowledge.some(k => k.knowledgeType === "security_scan" && (k.status === "pending" || k.status === "failed")) && (
            <button
              className="btn btn--secondary btn--sm"
              onClick={async () => {
                await startAllSecurityScans(projectId);
                await refresh();
              }}
            >
              Start All
            </button>
          )}
        </div>
        {(() => {
          const scans = knowledge.filter(k => k.knowledgeType === "security_scan");
          if (scans.length === 0) {
            return (
              <div className="pj-inline-empty">
                {knowledge.some(k => k.knowledgeType === "threat_map" && k.status === "active")
                  ? <>No scans yet. Click <strong>Create Threat Map Scans</strong> to start.</>
                  : "Generate a threat map first to enable security scans."}
              </div>
            );
          }
          const active = scans.filter(s => s.status === "active").length;
          const collecting = scans.filter(s => s.status === "collecting").length;
          const failed = scans.filter(s => s.status === "failed").length;
          const pending = scans.filter(s => s.status === "pending").length;
          return (
            <div>
              <div className="pj-metrics" style={{ marginBottom: 12 }}>
                <span>{scans.length} total</span>
                {active > 0 && <span style={{ color: "#059669" }}>{active} completed</span>}
                {collecting > 0 && <span style={{ color: "#6366f1" }}>{collecting} running</span>}
                {pending > 0 && <span>{pending} pending</span>}
                {failed > 0 && <span style={{ color: "#dc2626" }}>{failed} failed</span>}
              </div>
              <div className="pj-table-wrapper">
                <table className="pj-table">
                  <thead>
                    <tr>
                      <th>Flow</th>
                      <th>Status</th>
                      <th>Result</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {scans.map((s) => {
                      const val = s.value as any;
                      const findings = val.findings?.length ?? 0;
                      const dismissals = val.dismissals?.length ?? 0;
                      return (
                        <tr key={s.id}>
                          <td className="pj-mono">{s.key}</td>
                          <td><KnowledgeStatusBadge status={s.status} error={s.error} /></td>
                          <td>
                            {s.status === "active" ? (
                              <span>
                                {findings > 0 && <span style={{ color: "#dc2626" }}>{findings} finding(s)</span>}
                                {findings > 0 && dismissals > 0 && ", "}
                                {dismissals > 0 && <span style={{ color: "#059669" }}>{dismissals} dismissed</span>}
                                {findings === 0 && dismissals === 0 && <span className="pj-muted">—</span>}
                              </span>
                            ) : <span className="pj-muted">—</span>}
                          </td>
                          <td className="pj-actions-cell">
                            {(s.status === "pending" || s.status === "failed") && (
                              <button className="btn btn--primary btn--sm" onClick={async () => { await startKnowledgeCollection(projectId, s.id); refresh(); }}>Start</button>
                            )}
                            {s.status === "active" && (
                              <button className="btn btn--primary btn--sm" onClick={async () => { await startKnowledgeCollection(projectId, s.id); refresh(); }}>Rescan</button>
                            )}
                            {s.status === "collecting" && (
                              <button className="btn btn--danger btn--sm" onClick={async () => { await resetProjectKnowledge(projectId, s.id); refresh(); }}>Reset</button>
                            )}
                            <button className="btn btn--secondary btn--sm" onClick={() => setViewingKnowledgeId(s.id)}>View</button>
                            <button className="btn btn--danger btn--sm" onClick={async () => { await deleteProjectKnowledge(projectId, s.id); refresh(); }}>✕</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}
      </section>

      {/* Findings */}
      <section className="pj-section">
        <div className="pj-section__head">
          <h3 className="pj-section__title">Findings</h3>
          {knowledge.some(k => k.knowledgeType === "security_scan" && k.status === "active") && !knowledge.some(k => k.knowledgeType === "scan_summary") && (
            <button
              className="btn btn--primary btn--sm"
              onClick={async () => {
                const entry = await createScanSummaryEntry(projectId);
                await startKnowledgeCollection(projectId, entry.id);
                await refresh();
              }}
            >
              Generate Summary
            </button>
          )}
          {findings.length > 0 && (
            <button
              className="btn btn--secondary btn--sm"
              onClick={async () => {
                const res = await fetch(`/api/project/${encodeURIComponent(projectId)}/findings/export`, {
                  headers: { "x-internal-api-key": (import.meta as any).env.VITE_API_KEY ?? "" }
                });
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = res.headers.get("content-disposition")?.match(/filename="(.+)"/)?.[1] ?? "findings.xlsx";
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Export Excel
            </button>
          )}
        </div>
        {(() => {
          const summary = knowledge.find(k => k.knowledgeType === "scan_summary");
          if (!summary) return null;
          return (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", fontSize: 12, color: "#6b7280" }}>
              <span>Summary:</span>
              <KnowledgeStatusBadge status={summary.status} error={summary.error} />
              <span>v{summary.version}</span>
              <button className="btn btn--secondary btn--sm" onClick={() => setViewingKnowledgeId(summary.id)}>View</button>
              {summary.status === "active" && (
                <button className="btn btn--secondary btn--sm" onClick={async () => { await startKnowledgeCollection(projectId, summary.id); refresh(); }}>Re-run</button>
              )}
            </div>
          );
        })()}
        {findings.length === 0 ? (
          <div className="pj-inline-empty">No findings yet. Run security scans and generate a summary.</div>
        ) : (
          <div>
            <div className="pj-metrics" style={{ marginBottom: 12 }}>
              <span>{findingStats.total ?? 0} total</span>
              {(findingStats["severity:critical"] ?? 0) > 0 && <span style={{ color: "#dc2626" }}>{findingStats["severity:critical"]} critical</span>}
              {(findingStats["severity:high"] ?? 0) > 0 && <span style={{ color: "#ea580c" }}>{findingStats["severity:high"]} high</span>}
              {(findingStats["severity:medium"] ?? 0) > 0 && <span style={{ color: "#d97706" }}>{findingStats["severity:medium"]} medium</span>}
              {(findingStats["severity:low"] ?? 0) > 0 && <span>{findingStats["severity:low"]} low</span>}
              <span style={{ color: "#d1d5db" }}>|</span>
              {(findingStats["status:open"] ?? 0) > 0 && <span>{findingStats["status:open"]} open</span>}
              {(findingStats["status:confirmed"] ?? 0) > 0 && <span style={{ color: "#dc2626" }}>{findingStats["status:confirmed"]} confirmed</span>}
              {(findingStats["status:dismissed"] ?? 0) > 0 && <span style={{ color: "#6b7280" }}>{findingStats["status:dismissed"]} dismissed</span>}
              {(findingStats["status:dismissed_by_user"] ?? 0) > 0 && <span style={{ color: "#6b7280" }}>{findingStats["status:dismissed_by_user"]} user-dismissed</span>}
              {(findingStats["status:resolved"] ?? 0) > 0 && <span style={{ color: "#059669" }}>{findingStats["status:resolved"]} resolved</span>}
            </div>
            <div className="pj-table-wrapper">
              <table className="pj-table">
                <thead>
                  <tr>
                    <th>Severity</th>
                    <th>Title</th>
                    <th>Repo</th>
                    <th>File</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {findings.map((f) => (
                    <tr key={f.id}>
                      <td>
                        <span className={`pj-pill ${f.severity === "critical" ? "pj-pill--critical" : f.severity === "high" ? "pj-pill--high" : ""}`}>
                          {f.severity}
                        </span>
                      </td>
                      <td>
                        <details>
                          <summary style={{ cursor: "pointer", fontSize: 13 }}>{f.title}</summary>
                          <div style={{ padding: "8px 0", fontSize: 12, color: "#374151", lineHeight: 1.5 }}>
                            <div><strong>Category:</strong> {f.category}</div>
                            <div><strong>Evidence:</strong> {f.evidence}</div>
                            <div><strong>Why dangerous:</strong> {f.whyDangerous}</div>
                            <div><strong>Failure mode:</strong> {f.failureMode}</div>
                            <div><strong>Fix:</strong> {f.recommendedFix}</div>
                            {f.whatWouldConfirm && <div><strong>Would confirm:</strong> {f.whatWouldConfirm}</div>}
                            {f.dismissReason && <div><strong>Dismiss reason:</strong> {f.dismissReason} ({f.dismissedBy})</div>}
                          </div>
                        </details>
                      </td>
                      <td className="pj-mono">{f.repo}</td>
                      <td className="pj-mono">{f.file}{f.lineStart ? `:${f.lineStart}` : ""}</td>
                      <td><span className={`pj-pill ${f.status === "open" ? "" : f.status === "confirmed" ? "pj-pill--critical" : f.status === "resolved" ? "pj-pill--resolved" : "pj-pill--muted"}`}>{f.status}</span></td>
                      <td className="pj-actions-cell">
                        {(f.status === "open" || f.status === "dismissed") && (
                          <button className="btn btn--primary btn--sm" onClick={async () => { await confirmProjectFinding(projectId, f.id); refresh(); }}>Confirm</button>
                        )}
                        {(f.status === "open" || f.status === "confirmed") && (
                          <button className="btn btn--secondary btn--sm" onClick={async () => {
                            const reason = prompt("Dismiss reason:");
                            if (reason) { await dismissProjectFinding(projectId, f.id, reason); refresh(); }
                          }}>Dismiss</button>
                        )}
                        {(f.status === "dismissed_by_user" || f.status === "resolved") && (
                          <button className="btn btn--secondary btn--sm" onClick={async () => { await reopenProjectFinding(projectId, f.id); refresh(); }}>Reopen</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
  type TabKey = "value" | "graph" | "activity" | "history";
  const [tab, setTab] = useState<TabKey>("value");
  const [activity, setActivity] = useState<ProjectKnowledgeActivity[]>([]);
  const [history, setHistory] = useState<ProjectKnowledgeHistory[]>([]);
  const [loading, setLoading] = useState(false);

  // Check if this entry has a graph file
  const graphJson = useMemo(() => {
    const val = knowledge?.value as { files?: Array<{ filename: string; content: string }> } | undefined;
    const graphFile = val?.files?.find(f => f.filename === "threat-map-graph.json");
    if (!graphFile) return null;
    try { return JSON.parse(graphFile.content); } catch { return null; }
  }, [knowledge]);

  const loadTab = useCallback(async (t: TabKey) => {
    if (t === "value" || t === "graph") return;
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
      <div className="modal" style={tab === "graph" ? { width: "95vw", maxWidth: "95vw", height: "90vh", maxHeight: "90vh" } : undefined} onClick={(e) => e.stopPropagation()}>
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
          {(["value", ...(graphJson ? ["graph"] : []), "activity", "history"] as TabKey[]).map((t) => (
            <button
              key={t}
              className={`pj-tab ${tab === t ? "pj-tab--active" : ""}`}
              onClick={() => setTab(t)}
            >
              {{ value: "Current Value", graph: "Graph", activity: "Activity Log", history: "Version History" }[t]}
            </button>
          ))}
        </div>

        <div className="modal__body" style={tab === "graph" ? { padding: 0, height: "70vh" } : undefined}>
          {tab === "graph" && graphJson && (
            <ThreatMapGraph graph={graphJson} />
          )}

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
