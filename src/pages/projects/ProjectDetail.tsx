import { useState } from "react";
import { deleteProject } from "../../api/jobApi";
import { AddRepoModal } from "./modals/AddRepoModal";
import { KnowledgeDetailModal } from "./modals/KnowledgeDetailModal";
import { defaultStage, pipelineStages, type StageId, type StageState } from "./pipeline";
import { useProjectData } from "./useProjectData";
import { SetupTab } from "./setup/SetupTab";
import { ThreatMapTab } from "./threatmap/ThreatMapTab";
import { SecurityReviewSection } from "./review/SecurityReviewSection";
import { PerFlowScans } from "./review/PerFlowScans";
import { GapAnalysisSection } from "./review/GapAnalysisSection";
import { FindingsTab } from "./findings/FindingsTab";
import { TestingTab } from "./testing/TestingTab";
import "./ProjectDetail.css";

const STATE_LABEL: Record<StageState, string> = {
  todo: "To do",
  running: "Running",
  done: "Done",
  failed: "Needs attention",
};

const tabKey = (projectId: string) => `pj-tab:${projectId}`;

/** One project: its pipeline as tabs (setup → threat map → analysis → findings → testing). */
export function ProjectDetail({
  projectId,
  onBack,
  onDeleted,
}: {
  projectId: string;
  onBack: () => void;
  onDeleted: () => void;
}) {
  const data = useProjectData(projectId);
  const { project, knowledge, findings, loading, refresh, anyCollecting, agentLine } = data;
  const [addingRepo, setAddingRepo] = useState(false);
  const [viewingKnowledgeId, setViewingKnowledgeId] = useState<string | null>(null);
  // The tab the user picked for this project; until then, the first step not done yet
  const [picked, setPicked] = useState<StageId | null>(
    () => (sessionStorage.getItem(tabKey(projectId)) as StageId | null) ?? null,
  );

  if (loading) return <div className="pj-state">Loading…</div>;
  if (!project) return <div className="pj-state">Project not found.</div>;

  const repos = project.repos ?? [];
  const stages = pipelineStages(repos, knowledge, findings);
  const tab = picked ?? defaultStage(stages);
  const pick = (id: StageId) => {
    sessionStorage.setItem(tabKey(projectId), id);
    setPicked(id);
    window.scrollTo({ top: 0 });
  };

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
          {anyCollecting && (
            <span className="pj-live" role="status">
              <span className="pj-live__dot" aria-hidden="true" />
              {agentLine ?? "Working…"}
            </span>
          )}
          <button className="btn btn--secondary btn--sm" onClick={refresh} title="Reload the project">
            ↻ Refresh
          </button>
          <button
            className="btn btn--secondary btn--sm pj-danger-text"
            onClick={async () => {
              if (!confirm(`Delete ${project.name} and everything it collected? This cannot be undone.`))
                return;
              await deleteProject(projectId);
              onDeleted();
            }}
          >
            Delete project
          </button>
        </div>
      </div>

      <nav className="pj-pipeline" aria-label="Threat modeling steps">
        {stages.map((s, i) => (
          <button
            key={s.id}
            className={`pj-stage pj-stage--${s.state} ${tab === s.id ? "pj-stage--active" : ""}`}
            onClick={() => pick(s.id)}
            aria-current={tab === s.id ? "step" : undefined}
            title={`${s.label}: ${s.summary}`}
          >
            <span className="pj-stage__num" aria-hidden="true">
              {s.state === "done" ? "✓" : i + 1}
            </span>
            <span className="pj-stage__text">
              <span className="pj-stage__label">{s.label}</span>
              <span className="pj-stage__summary">
                <span className="pj-visually-hidden">{STATE_LABEL[s.state]}: </span>
                {s.state === "running" ? "Running · " : s.state === "failed" ? "Needs attention · " : ""}
                {s.summary}
              </span>
            </span>
          </button>
        ))}
      </nav>

      {tab === "setup" && (
        <SetupTab
          projectId={projectId}
          repos={repos}
          knowledge={knowledge}
          refresh={refresh}
          onView={setViewingKnowledgeId}
          onAddRepo={() => setAddingRepo(true)}
        />
      )}
      {tab === "threatMap" && (
        <ThreatMapTab
          projectId={projectId}
          knowledge={knowledge}
          refresh={refresh}
          onView={setViewingKnowledgeId}
          onNext={() => pick("analysis")}
        />
      )}
      {tab === "analysis" && (
        <>
          <SecurityReviewSection
            projectId={projectId}
            knowledge={knowledge}
            hasRepos={repos.length > 0}
            refresh={refresh}
            setViewingKnowledgeId={setViewingKnowledgeId}
            agentLine={agentLine}
          />
          <PerFlowScans
            projectId={projectId}
            knowledge={knowledge}
            refresh={refresh}
            onView={setViewingKnowledgeId}
            agentLine={agentLine}
          />
          <GapAnalysisSection
            projectId={projectId}
            knowledge={knowledge}
            refresh={refresh}
            setViewingKnowledgeId={setViewingKnowledgeId}
            agentLine={agentLine}
          />
        </>
      )}
      {tab === "findings" && (
        <FindingsTab
          projectId={projectId}
          knowledge={knowledge}
          findings={findings}
          refresh={refresh}
          onView={setViewingKnowledgeId}
        />
      )}
      {tab === "testing" && (
        <TestingTab
          projectId={projectId}
          knowledge={knowledge}
          findings={findings}
          swarms={data.swarms}
          envConfig={data.envConfig}
          setEnvConfig={data.setEnvConfig}
          refresh={refresh}
          onView={setViewingKnowledgeId}
        />
      )}

      {addingRepo && (
        <AddRepoModal
          projectId={projectId}
          onClose={() => setAddingRepo(false)}
          onAdded={() => {
            setAddingRepo(false);
            void refresh();
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
