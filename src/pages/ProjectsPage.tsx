import { useState, useEffect, useCallback } from "react";
import { getProjects } from "../api/jobApi";
import type { Project } from "../types/job.types";
import { ProjectDetail } from "./projects/ProjectDetail";
import { CreateProjectModal } from "./projects/modals/CreateProjectModal";
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
        <button
          className="btn btn--primary btn--sm"
          onClick={() => setCreating(true)}
        >
          + New Project
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="pj-empty-card">
          <h3>No projects yet</h3>
          <p>
            Group related repositories into a system, then run the
            threat-modeling pipeline across them.
          </p>
          <button
            className="btn btn--primary btn--sm"
            onClick={() => setCreating(true)}
          >
            + New Project
          </button>
        </div>
      ) : (
        <div className="pj-grid">
          {projects.map((p) => (
            <button
              key={p.id}
              className="pj-card"
              onClick={() => setSelectedId(p.id)}
            >
              <div className="pj-card__head">
                <span className="pj-card__name">{p.name}</span>
                <span
                  className={`pj-badge ${p.enabled ? "pj-badge--on" : "pj-badge--off"}`}
                >
                  {p.enabled ? "Enabled" : "Disabled"}
                </span>
              </div>
              {p.description && (
                <p className="pj-card__desc">{p.description}</p>
              )}
              <div className="pj-card__meta">
                {p.repos?.length ?? 0} repo
                {(p.repos?.length ?? 0) !== 1 ? "s" : ""}
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
