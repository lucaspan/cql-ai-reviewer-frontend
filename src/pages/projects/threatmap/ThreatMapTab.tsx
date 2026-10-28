import { useMemo, useState } from "react";
import {
  createThreatMapEntry,
  startKnowledgeCollection,
} from "../../../api/jobApi";
import type { ProjectKnowledge } from "../../../types/job.types";
import ThreatMapGraph from "../../../components/ThreatMapGraph";
import { EntryActions } from "../EntryActions";
import { KnowledgeStatusBadge } from "../KnowledgeStatusBadge";
import { threatMapGraph } from "../pipeline";

/** Step 2: the threat map, built from the setup knowledge, and its graph. */
export function ThreatMapTab({
  projectId,
  knowledge,
  refresh,
  onView,
  onNext,
}: {
  projectId: string;
  knowledge: ProjectKnowledge[];
  refresh: () => Promise<void>;
  onView: (id: string) => void;
  onNext: () => void;
}) {
  const [starting, setStarting] = useState(false);
  const entry = knowledge.find((k) => k.knowledgeType === "threat_map");
  const ready = ["repo_profile", "endpoint_inventory"].every((t) =>
    knowledge.some((k) => k.knowledgeType === t && k.status === "active"),
  );
  const graph = useMemo(() => threatMapGraph(entry), [entry]);
  const stats = useMemo(() => {
    if (!graph) return null;
    const nodes = graph.nodes as Array<{ trustZone?: string }>;
    return {
      components: nodes.length,
      zones: new Set(nodes.map((n) => n.trustZone).filter(Boolean)).size,
      flows: graph.edges.filter((e) => e.type === "data_flow").length,
      threats: graph.annotations?.length ?? 0,
    };
  }, [graph]);

  const build = async () => {
    setStarting(true);
    try {
      const created = await createThreatMapEntry(projectId);
      await startKnowledgeCollection(projectId, created.id);
    } finally {
      setStarting(false);
      await refresh();
    }
  };

  return (
    <section className="pj-section">
      <div className="pj-section__head">
        <div>
          <h3 className="pj-section__title">Threat Map</h3>
          <p className="pj-hint">
            Trust zones, components and the data flows between them, with the STRIDE threats on
            each flow. Built from the repo profiles and endpoint inventories, and the runtime
            topology if there is one.
          </p>
        </div>
        {!entry && (
          <button
            className="btn btn--primary btn--sm"
            disabled={starting || !ready}
            title={ready ? undefined : "Run the repo profiles and endpoint inventories in Setup first"}
            onClick={build}
          >
            {starting ? "Starting…" : "Build threat map"}
          </button>
        )}
      </div>

      {!entry ? (
        <div className="pj-inline-empty">
          {ready
            ? "Not built yet."
            : "Run the repo profiles and endpoint inventories in Setup first; the threat map is built from them."}
        </div>
      ) : (
        <>
          <div className="pj-entry-bar">
            <KnowledgeStatusBadge status={entry.status} error={entry.error} />
            <span className="pj-muted">v{entry.version}</span>
            {stats && (
              <span className="pj-entry-bar__stats">
                {stats.components} components · {stats.zones} trust zones · {stats.flows} data flows
                · {stats.threats} threats
              </span>
            )}
            <EntryActions
              projectId={projectId}
              entry={entry}
              refresh={refresh}
              onView={onView}
              deleteMessage="Delete the threat map and its history? The per-flow scans keep their results."
            />
          </div>
          {entry.status === "failed" && entry.error && (
            <div className="pj-review-error">{entry.error}</div>
          )}
          {graph ? (
            <div className="pj-graph-frame">
              <ThreatMapGraph graph={graph as Parameters<typeof ThreatMapGraph>[0]["graph"]} />
            </div>
          ) : (
            entry.status === "collecting" && (
              <div className="pj-inline-empty">Building the threat map…</div>
            )
          )}
          {stats && stats.flows > 0 && (
            <div className="pj-next">
              <span>
                Next: the Analysis step reviews the whole application and runs a STRIDE scan on
                each of the {stats.flows} data flows.
              </span>
              <button className="btn btn--secondary btn--sm" onClick={onNext}>
                Go to Analysis →
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
