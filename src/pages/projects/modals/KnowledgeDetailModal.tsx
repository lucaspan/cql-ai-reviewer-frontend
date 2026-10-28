import { useState, useEffect, useCallback, useMemo } from "react";
import {
  getKnowledgeActivity,
  getKnowledgeHistory,
} from "../../../api/jobApi";
import type {
  ProjectKnowledge,
  ProjectKnowledgeActivity,
  ProjectKnowledgeHistory,
} from "../../../types/job.types";
import { KnowledgeStatusBadge } from "../KnowledgeStatusBadge";
import ThreatMapGraph from "../../../components/ThreatMapGraph";
import RuntimeTopologyGraph from "../../../components/RuntimeTopologyGraph";

export function KnowledgeDetailModal({
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
    const val = knowledge?.value as
      | { files?: Array<{ filename: string; content: string }> }
      | undefined;
    const graphFile = val?.files?.find(
      (f) => f.filename === "threat-map-graph.json",
    );
    if (!graphFile) return null;
    try {
      return JSON.parse(graphFile.content);
    } catch {
      return null;
    }
  }, [knowledge]);

  // Runtime topology ships its own graph shape and needs a different renderer.
  const topologyJson = useMemo(() => {
    const val = knowledge?.value as
      | { files?: Array<{ filename: string; content: string }> }
      | undefined;
    const file = val?.files?.find(
      (f) => f.filename === "observed-topology.json",
    );
    if (!file) return null;
    try {
      return JSON.parse(file.content);
    } catch {
      return null;
    }
  }, [knowledge]);

  const hasGraph = Boolean(graphJson || topologyJson);

  const loadTab = useCallback(
    async (t: TabKey) => {
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
    },
    [projectId, knowledgeId],
  );

  useEffect(() => {
    loadTab(tab);
  }, [tab, loadTab]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        style={
          tab === "graph"
            ? {
                width: "95vw",
                maxWidth: "95vw",
                height: "90vh",
                maxHeight: "90vh",
              }
            : undefined
        }
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__header">
          <div>
            <h2 className="modal__title">Knowledge Detail</h2>
            <p className="modal__subtitle">
              {knowledge?.key ?? knowledgeId.slice(0, 8)}
              {knowledge && (
                <>
                  {" "}
                  &middot; v{knowledge.version} &middot;{" "}
                  <KnowledgeStatusBadge
                    status={knowledge.status}
                    error={knowledge.error}
                  />
                </>
              )}
            </p>
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

        <div className="pj-tabs">
          {(
            [
              "value",
              ...(hasGraph ? ["graph"] : []),
              "activity",
              "history",
            ] as TabKey[]
          ).map((t) => (
            <button
              key={t}
              className={`pj-tab ${tab === t ? "pj-tab--active" : ""}`}
              onClick={() => setTab(t)}
            >
              {
                {
                  value: "Current Value",
                  graph: "Graph",
                  activity: "Activity Log",
                  history: "Version History",
                }[t]
              }
            </button>
          ))}
        </div>

        <div
          className="modal__body"
          style={tab === "graph" ? { padding: 0, height: "70vh" } : undefined}
        >
          {tab === "graph" && graphJson && <ThreatMapGraph graph={graphJson} />}
          {tab === "graph" && !graphJson && topologyJson && (
            <RuntimeTopologyGraph graph={topologyJson} />
          )}

          {tab === "value" && knowledge && (
            <div className="pj-knowledge-value">
              {knowledge.error && (
                <div className="pj-run__error">{knowledge.error}</div>
              )}
              <pre className="pj-json">
                {JSON.stringify(knowledge.value, null, 2)}
              </pre>
            </div>
          )}

          {tab === "activity" &&
            (loading ? (
              <div className="pj-state">Loading...</div>
            ) : activity.length === 0 ? (
              <div className="pj-inline-empty">No activity yet.</div>
            ) : (
              <div className="activity-list">
                {[...activity].reverse().map((a, i) => (
                  <div key={a.id ?? i} className="activity-item">
                    <div className="activity-item__header">
                      <span className="pj-pill">{a.action}</span>
                      <span className="activity-item__time">
                        v{a.version} &middot;{" "}
                        {new Date(a.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="activity-item__message">{a.message}</p>
                    {a.metadata != null && (
                      <pre className="activity-item__metadata">
                        {JSON.stringify(a.metadata, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            ))}

          {tab === "history" &&
            (loading ? (
              <div className="pj-state">Loading...</div>
            ) : history.length === 0 ? (
              <div className="pj-inline-empty">No previous versions.</div>
            ) : (
              <div className="pj-history-list">
                {history.map((h) => (
                  <div key={h.id} className="pj-history-item">
                    <div className="pj-history-item__head">
                      <span className="pj-pill">v{h.version}</span>
                      <span className="pj-muted">{h.source}</span>
                      <span className="pj-muted">
                        {new Date(h.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {h.metrics && (
                      <div className="pj-metrics">
                        <span>Model: {h.metrics.model}</span>
                        <span>
                          In: {h.metrics.inputTokens.toLocaleString()}
                        </span>
                        <span>
                          Out: {h.metrics.outputTokens.toLocaleString()}
                        </span>
                        <span>
                          Cache R/W:{" "}
                          {h.metrics.cacheReadTokens.toLocaleString()}/
                          {h.metrics.cacheWriteTokens.toLocaleString()}
                        </span>
                        <span>Steps: {h.metrics.steps}</span>
                        <span>Cost: ${h.metrics.totalCost.toFixed(4)}</span>
                        <span>{(h.metrics.durationMs / 1000).toFixed(1)}s</span>
                      </div>
                    )}
                    <details>
                      <summary>Value</summary>
                      <pre className="pj-json">
                        {JSON.stringify(h.value, null, 2)}
                      </pre>
                    </details>
                  </div>
                ))}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
