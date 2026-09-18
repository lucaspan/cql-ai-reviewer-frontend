import { useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  Position,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

type Evidence = "code" | "runtime" | "both";

interface ObservedEndpoint {
  method: string;
  path: string;
  normalizedPath: string;
  calls: number;
  failures: number;
  evidence?: Evidence;
  declaredPath?: string;
}

interface TopologyNode {
  id: string;
  label: string;
  kind: "service" | "datastore" | "external";
  repo?: string;
  isNeighbour: boolean;
  ownershipGap?: boolean;
  isPlaceholder?: boolean;
  appCatId?: string;
  namespace?: string;
  technology?: string;
  endpoints?: ObservedEndpoint[];
  observedCalls?: number;
  observedFailures?: number;
  discoveredBy: Evidence;
}

interface TopologyEdge {
  source: string;
  target: string;
  type: "calls" | "reads_writes" | "egress";
  evidence: Evidence;
  observedCalls?: number;
}

interface UnobservedEndpoint {
  repo: string;
  method: string;
  pathTemplate: string;
  file: string;
  line?: number;
  authAnnotation?: string;
}

interface ReconciliationSummary {
  reposReconciled: string[];
  declaredEndpoints: number;
  declaredNonHttp: number;
  observedEndpoints: number;
  observedMatched: number;
  matched: number;
  codeOnly: number;
  runtimeOnly: number;
  unmappedRepos: string[];
  nonHttpRepos: string[];
  strippedPrefixes: string[];
  strippedDeclaredPrefixes: string[];
}

interface TopologyGraph {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  unobservedEndpoints?: UnobservedEndpoint[];
  reconciliation?: ReconciliationSummary;
}

/** Repos, cross-boundary services and infrastructure are read very differently, so keep them apart. */
type GroupKind =
  | "repo"
  | "neighbour"
  | "unattributed"
  | "placeholder"
  | "datastore"
  | "external";

interface Group {
  id: string;
  label: string;
  sublabel?: string;
  kind: GroupKind;
  services: TopologyNode[];
  calls: number;
  failures: number;
  endpoints: number;
  matchedEndpoints: number;
  undeclaredEndpoints: number;
}

const THEME: Record<
  GroupKind,
  { bg: string; border: string; text: string; title: string }
> = {
  repo: {
    bg: "#eef2ff",
    border: "#6366f1",
    text: "#312e81",
    title: "Owned repo",
  },
  neighbour: {
    bg: "#ecfdf5",
    border: "#10b981",
    text: "#065f46",
    title: "Other App Cat ID",
  },
  unattributed: {
    bg: "#fff7ed",
    border: "#f97316",
    text: "#9a3412",
    title: "No App Cat tag",
  },
  placeholder: {
    bg: "#f4f4f5",
    border: "#a1a1aa",
    text: "#52525b",
    title: "Dynatrace placeholder",
  },
  datastore: {
    bg: "#fefce8",
    border: "#ca8a04",
    text: "#713f12",
    title: "Datastore",
  },
  external: {
    bg: "#fdf4ff",
    border: "#c026d3",
    text: "#86198f",
    title: "External dependency",
  },
};

const LANE: Record<GroupKind, number> = {
  repo: 0,
  neighbour: 1,
  unattributed: 1,
  placeholder: 2,
  datastore: 2,
  external: 2,
};

const LANE_TITLES = [
  "Owned services",
  "Cross-boundary services",
  "Infrastructure & egress",
];

function groupIdOf(n: TopologyNode): string {
  if (n.kind !== "service") return `${n.kind}:${n.label}`;
  if (n.repo) return `repo:${n.repo}`;
  if (n.isPlaceholder) return `placeholder:${n.label}`;
  return n.appCatId ? `neighbour:${n.appCatId}` : "unattributed";
}

function groupKindOf(id: string): GroupKind {
  const prefix = id.split(":")[0];
  if (prefix === "repo" || prefix === "neighbour" || prefix === "placeholder")
    return prefix;
  if (prefix === "datastore" || prefix === "external") return prefix;
  return "unattributed";
}

function shortRepo(repo: string): string {
  return repo.split("/").pop() ?? repo;
}

export default function RuntimeTopologyGraph({
  graph,
}: {
  graph: TopologyGraph;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  const { groups, aggEdges } = useMemo(() => {
    const byId = new Map(graph.nodes.map((n) => [n.id, n]));
    const groups = new Map<string, Group>();

    for (const n of graph.nodes) {
      const id = groupIdOf(n);
      const kind = groupKindOf(id);
      let g = groups.get(id);
      if (!g) {
        g = {
          id,
          label:
            kind === "repo"
              ? shortRepo(n.repo!)
              : kind === "neighbour"
                ? `App Cat ${n.appCatId}`
                : kind === "unattributed"
                  ? "Unattributed services"
                  : n.label,
          kind,
          services: [],
          calls: 0,
          failures: 0,
          endpoints: 0,
          matchedEndpoints: 0,
          undeclaredEndpoints: 0,
        };
        groups.set(id, g);
      }
      g.services.push(n);
      g.calls += n.observedCalls ?? 0;
      g.failures += n.observedFailures ?? 0;
      for (const e of n.endpoints ?? []) {
        g.endpoints++;
        if (e.evidence === "both") g.matchedEndpoints++;
        if (e.evidence === "runtime") g.undeclaredEndpoints++;
      }
    }

    const agg = new Map<
      string,
      { source: string; target: string; calls: number; type: string }
    >();
    for (const e of graph.edges) {
      const s = byId.get(e.source);
      const t = byId.get(e.target);
      if (!s || !t) continue;
      const a = groupIdOf(s);
      const b = groupIdOf(t);
      if (a === b) continue;
      const key = `${a}->${b}:${e.type}`;
      const existing = agg.get(key);
      if (existing) existing.calls += e.observedCalls ?? 0;
      else
        agg.set(key, {
          source: a,
          target: b,
          calls: e.observedCalls ?? 0,
          type: e.type,
        });
    }

    return { groups: [...groups.values()], aggEdges: [...agg.values()] };
  }, [graph]);

  const { flowNodes, flowEdges } = useMemo(() => {
    const lanes: Group[][] = [[], [], []];
    for (const g of groups) lanes[LANE[g.kind]].push(g);
    for (const lane of lanes)
      lane.sort((a, b) => b.calls - a.calls || a.label.localeCompare(b.label));

    const nodeW = 250;
    const laneGap = 460;
    const rowGap = 104;
    const pos = new Map<string, { x: number; y: number }>();
    lanes.forEach((lane, i) =>
      lane.forEach((g, j) => pos.set(g.id, { x: i * laneGap, y: j * rowGap })),
    );

    const connected = new Set<string>();
    if (selected) {
      for (const e of aggEdges) {
        if (e.source === selected) connected.add(e.target);
        if (e.target === selected) connected.add(e.source);
      }
    }

    const flowNodes: Node[] = groups.map((g) => {
      const theme = THEME[g.kind];
      const dim =
        Boolean(selected) && g.id !== selected && !connected.has(g.id);
      return {
        id: g.id,
        position: pos.get(g.id)!,
        data: {
          label: (
            <div style={{ textAlign: "left", opacity: dim ? 0.35 : 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: theme.text }}>
                {g.label}
              </div>
              <div style={{ fontSize: 9, color: "#6b7280", marginTop: 2 }}>
                {g.services.length} service{g.services.length === 1 ? "" : "s"}
                {g.calls > 0 && <> &middot; {g.calls.toLocaleString()} calls</>}
              </div>
              {g.endpoints > 0 && (
                <div style={{ fontSize: 9, color: "#4b5563", marginTop: 2 }}>
                  {g.endpoints} endpoint{g.endpoints === 1 ? "" : "s"}
                  {g.undeclaredEndpoints > 0 && (
                    <span style={{ color: "#b45309", fontWeight: 600 }}>
                      {" "}
                      &middot; {g.undeclaredEndpoints} undeclared
                    </span>
                  )}
                </div>
              )}
              {g.failures > 0 && (
                <div style={{ fontSize: 9, color: "#b91c1c", marginTop: 2 }}>
                  {g.failures.toLocaleString()} failed
                </div>
              )}
            </div>
          ),
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        style: {
          background: theme.bg,
          // Ownership gaps are unresolved questions, not confirmed components.
          border: `${g.id === selected ? 2.5 : 1.5}px ${g.kind === "unattributed" || g.kind === "placeholder" ? "dashed" : "solid"} ${theme.border}`,
          borderRadius: 8,
          padding: "7px 10px",
          width: nodeW,
          cursor: "pointer",
          opacity: dim ? 0.4 : 1,
        },
      };
    });

    const maxCalls = Math.max(1, ...aggEdges.map((e) => e.calls));
    const flowEdges: Edge[] = aggEdges.map((e) => {
      const isConnected = e.source === selected || e.target === selected;
      const dim = Boolean(selected) && !isConnected;
      const colour =
        e.type === "calls"
          ? "#6366f1"
          : e.type === "reads_writes"
            ? "#ca8a04"
            : "#c026d3";
      return {
        id: `${e.source}->${e.target}:${e.type}`,
        source: e.source,
        target: e.target,
        type: "smoothstep",
        animated: isConnected && e.calls > 0,
        zIndex: isConnected ? 1000 : 0,
        style: {
          stroke: dim ? "#d1d5db" : colour,
          strokeWidth: 1 + 3 * Math.sqrt(e.calls / maxCalls),
          opacity: dim ? 0.08 : isConnected ? 0.95 : 0.28,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 10,
          height: 10,
          color: dim ? "#d1d5db" : colour,
        },
      };
    });

    return { flowNodes, flowEdges };
  }, [groups, aggEdges, selected]);

  const sel = selected ? groups.find((g) => g.id === selected) : null;
  const r = graph.reconciliation;
  const selUnobserved =
    sel?.kind === "repo"
      ? (graph.unobservedEndpoints ?? []).filter(
          (u) => `repo:${u.repo}` === sel.id,
        )
      : [];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        overflow: "hidden",
        background: "#fff",
        height: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "10px 16px",
          background: "#f9fafb",
          borderBottom: "1px solid #e5e7eb",
          flexWrap: "wrap",
          fontSize: 11,
        }}
      >
        {(Object.keys(THEME) as GroupKind[])
          .filter((k) => groups.some((g) => g.kind === k))
          .map((k) => (
            <span
              key={k}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                color: THEME[k].text,
              }}
            >
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 3,
                  background: THEME[k].bg,
                  border: `1.5px ${k === "unattributed" || k === "placeholder" ? "dashed" : "solid"} ${THEME[k].border}`,
                }}
              />
              {THEME[k].title}
            </span>
          ))}
        <span style={{ width: 1, height: 16, background: "#d1d5db" }} />
        <span style={{ color: "#6b7280" }}>
          Line thickness = observed call volume
        </span>
        {r && (
          <span style={{ marginLeft: "auto", color: "#4b5563" }}>
            <strong>{r.matched}</strong>/{r.declaredEndpoints} declared routes
            corroborated &middot; <strong>{r.codeOnly}</strong> not observed
            &middot; <strong>{r.runtimeOnly}</strong> undeclared
          </span>
        )}
      </div>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <div style={{ flex: 1, minWidth: 0, position: "relative" }}>
          <div
            style={{
              position: "absolute",
              top: 8,
              left: 0,
              right: 0,
              display: "flex",
              zIndex: 5,
              pointerEvents: "none",
            }}
          >
            {LANE_TITLES.map((t) => (
              <div
                key={t}
                style={{
                  flex: 1,
                  textAlign: "center",
                  fontSize: 10,
                  fontWeight: 600,
                  color: "#9ca3af",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                {t}
              </div>
            ))}
          </div>
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            onNodeClick={(_, n) => setSelected(n.id === selected ? null : n.id)}
            onPaneClick={() => setSelected(null)}
            fitView
            minZoom={0.1}
            proOptions={{ hideAttribution: true }}
          >
            <Background />
            <Controls />
            <MiniMap pannable zoomable />
          </ReactFlow>
        </div>

        {sel && (
          <div
            style={{
              width: 400,
              borderLeft: "1px solid #e5e7eb",
              overflowY: "auto",
              padding: 16,
              background: "#fafafa",
            }}
          >
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: THEME[sel.kind].text,
              }}
            >
              {sel.label}
            </div>
            <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 12 }}>
              {THEME[sel.kind].title} &middot; {sel.services.length} service
              {sel.services.length === 1 ? "" : "s"}
              {sel.calls > 0 && (
                <> &middot; {sel.calls.toLocaleString()} calls</>
              )}
            </div>

            {sel.kind === "unattributed" && (
              <p
                style={{
                  fontSize: 11,
                  color: "#9a3412",
                  background: "#fff7ed",
                  padding: 8,
                  borderRadius: 6,
                }}
              >
                These services carry no App Cat tag. That is an ownership gap to
                investigate, not proof of shadow infrastructure.
              </p>
            )}
            {sel.kind === "placeholder" && (
              <p
                style={{
                  fontSize: 11,
                  color: "#52525b",
                  background: "#f4f4f5",
                  padding: 8,
                  borderRadius: 6,
                }}
              >
                Synthesised by Dynatrace for traffic it could not attribute to a
                monitored entity. Not a real service.
              </p>
            )}

            {sel.endpoints > 0 && (
              <>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    margin: "14px 0 6px",
                    color: "#374151",
                  }}
                >
                  Observed endpoints ({sel.endpoints})
                </div>
                {[...sel.services.flatMap((s) => s.endpoints ?? [])]
                  .sort((a, b) => b.calls - a.calls)
                  .slice(0, 40)
                  .map((e, i) => (
                    <div
                      key={i}
                      style={{
                        fontSize: 10,
                        padding: "5px 7px",
                        marginBottom: 4,
                        background: "#fff",
                        border: "1px solid #e5e7eb",
                        borderLeft: `3px solid ${e.evidence === "both" ? "#10b981" : "#f97316"}`,
                        borderRadius: 4,
                      }}
                    >
                      <div
                        style={{ fontFamily: "monospace", color: "#111827" }}
                      >
                        {e.method} {e.normalizedPath}
                      </div>
                      <div style={{ color: "#6b7280", marginTop: 2 }}>
                        {e.calls.toLocaleString()} calls
                        {e.failures > 0 && (
                          <span style={{ color: "#b91c1c" }}>
                            {" "}
                            &middot; {e.failures.toLocaleString()} failed
                          </span>
                        )}
                        {e.evidence === "runtime" && (
                          <span style={{ color: "#b45309", fontWeight: 600 }}>
                            {" "}
                            &middot; not declared in code
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
              </>
            )}

            {selUnobserved.length > 0 && (
              <>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    margin: "14px 0 6px",
                    color: "#374151",
                  }}
                >
                  Declared but not observed ({selUnobserved.length})
                </div>
                <p style={{ fontSize: 10, color: "#6b7280", marginBottom: 6 }}>
                  No traffic in the window. Not evidence the route is dead.
                </p>
                {selUnobserved.map((u, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize: 10,
                      padding: "5px 7px",
                      marginBottom: 4,
                      background: "#fff",
                      border: "1px solid #e5e7eb",
                      borderLeft: "3px solid #9ca3af",
                      borderRadius: 4,
                    }}
                  >
                    <div style={{ fontFamily: "monospace", color: "#111827" }}>
                      {u.method} {u.pathTemplate}
                    </div>
                    <div style={{ color: "#6b7280", marginTop: 2 }}>
                      {u.file}
                      {u.line ? `:${u.line}` : ""}
                      {u.authAnnotation && <> &middot; {u.authAnnotation}</>}
                    </div>
                  </div>
                ))}
              </>
            )}

            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                margin: "14px 0 6px",
                color: "#374151",
              }}
            >
              Services ({sel.services.length})
            </div>
            {sel.services.slice(0, 60).map((s) => (
              <div
                key={s.id}
                style={{ fontSize: 10, color: "#4b5563", padding: "2px 0" }}
              >
                <span style={{ fontFamily: "monospace" }}>{s.label}</span>
                {s.observedCalls ? (
                  <span style={{ color: "#9ca3af" }}>
                    {" "}
                    &middot; {s.observedCalls.toLocaleString()}
                  </span>
                ) : null}
              </div>
            ))}
            {sel.services.length > 60 && (
              <div style={{ fontSize: 10, color: "#9ca3af" }}>
                …and {sel.services.length - 60} more
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
