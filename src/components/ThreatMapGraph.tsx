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

/**
 * Sources that independently corroborate a node or edge. Open-ended: new providers append
 * rather than multiplying combinations, so `["code"]` and `["code","runtime","cmdb"]` both work.
 */
type EvidenceSource = string;

/** Declared but nothing corroborated it — not proof it is unreachable. */
const isUnobserved = (evidence: EvidenceSource[] = []) =>
  evidence.length > 0 && evidence.every((s) => s === "code");

/** Corroborated by observation but absent from source — an ownership or drift question. */
const isUndeclared = (evidence: EvidenceSource[] = []) =>
  evidence.length > 0 && !evidence.includes("code");

interface GraphNode {
  id: string;
  type: string;
  label: string;
  trustZone: string;
  componentType?: string;
  description?: string;
  repo?: string;
  evidence: EvidenceSource[];
  /** One logical component maps to many Dynatrace entities — environments and blue/green are separate. */
  dtEntityIds?: string[];
}

interface GraphEdge {
  id: string;
  type: string;
  source: string;
  target: string;
  label?: string;
  assets?: string[];
  authControl?: string;
  evidence: EvidenceSource[];
  observedCalls?: number;
  lastSeen?: string;
}

interface GraphAnnotation {
  id: string;
  type: string;
  attachedTo: string;
  category: string;
  description: string;
}

interface ThreatMapGraphProps {
  graph: {
    nodes: GraphNode[];
    edges: GraphEdge[];
    annotations: GraphAnnotation[];
  };
}

const ZONE_ORDER = ["Public", "Edge", "Private", "Restricted", "External"];

const ZONE_THEME: Record<
  string,
  {
    bg: string;
    border: string;
    label: string;
    nodeBg: string;
    nodeText: string;
  }
> = {
  Public: {
    bg: "#fef2f2",
    border: "#fca5a5",
    label: "#991b1b",
    nodeBg: "#ffffff",
    nodeText: "#1f2937",
  },
  Edge: {
    bg: "#fffbeb",
    border: "#fcd34d",
    label: "#92400e",
    nodeBg: "#ffffff",
    nodeText: "#1f2937",
  },
  Private: {
    bg: "#eff6ff",
    border: "#93c5fd",
    label: "#1e3a8a",
    nodeBg: "#ffffff",
    nodeText: "#1f2937",
  },
  Restricted: {
    bg: "#f5f3ff",
    border: "#c4b5fd",
    label: "#5b21b6",
    nodeBg: "#ffffff",
    nodeText: "#1f2937",
  },
  External: {
    bg: "#f9fafb",
    border: "#d1d5db",
    label: "#374151",
    nodeBg: "#ffffff",
    nodeText: "#1f2937",
  },
};

const STRIDE_COLORS: Record<string, string> = {
  Spoofing: "#dc2626",
  Tampering: "#ea580c",
  Repudiation: "#7c3aed",
  "Information Disclosure": "#2563eb",
  "Denial of Service": "#db2777",
  "Elevation of Privilege": "#d97706",
};

const EVIDENCE_LABEL: Record<
  string,
  { text: string; colour: string; title: string }
> = {
  corroborated: {
    text: "Declared + observed",
    colour: "#059669",
    title:
      "Found in source and corroborated by observed traffic in Dynatrace. The strongest evidence.",
  },
  unobserved: {
    text: "Declared, not observed",
    colour: "#6b7280",
    title:
      "Declared in source but no traffic seen in the query window. Not proof it is unreachable — it may be seasonal, admin-only, or in an environment that was not mapped.",
  },
  undeclared: {
    text: "Observed, not declared",
    colour: "#c2410c",
    title:
      "Seen running but not matched to any declaration in source. Either the endpoint inventory missed it, or the deployed surface has drifted from the code.",
  },
};

function EvidenceBadge({ evidence = [] }: { evidence?: EvidenceSource[] }) {
  const key = isUndeclared(evidence)
    ? "undeclared"
    : isUnobserved(evidence)
      ? "unobserved"
      : "corroborated";
  const e = EVIDENCE_LABEL[key];
  return (
    <span
      // Show the raw list so additional providers are visible without a code change.
      title={`${e.title}\n\nSources: ${evidence.join(", ") || "none"}`}
      style={{
        fontSize: 9,
        padding: "1px 6px",
        borderRadius: 3,
        background: e.colour + "18",
        color: e.colour,
        border: `1px solid ${e.colour}44`,
        whiteSpace: "nowrap",
      }}
    >
      {e.text}
      {evidence.length > 2 ? ` (${evidence.length} sources)` : ""}
    </span>
  );
}

export default function ThreatMapGraph({ graph }: ThreatMapGraphProps) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);

  const { flowNodes, baseEdges } = useMemo(() => {
    // Group nodes by trust zone
    const zoneGroups: Record<string, GraphNode[]> = {};
    for (const node of graph.nodes) {
      const zone = node.trustZone || "External";
      if (!zoneGroups[zone]) zoneGroups[zone] = [];
      zoneGroups[zone].push(node);
    }

    const sortedZones = ZONE_ORDER.filter((z) => zoneGroups[z]?.length);
    for (const z of Object.keys(zoneGroups)) {
      if (!sortedZones.includes(z)) sortedZones.push(z);
    }

    // Layout config
    const colWidth = 300;
    const nodeW = 220;
    const nodeH = 70;
    const rowGap = 24;
    const zonePadTop = 48;
    const zonePadX = 40;
    const zonePadBot = 24;
    const startX = 40;
    const startY = 20;

    const flowNodes: Node[] = [];

    sortedZones.forEach((zone, colIdx) => {
      const nodes = zoneGroups[zone];
      const zoneX = startX + colIdx * colWidth;
      const zoneW = colWidth - 16;
      const zoneH =
        zonePadTop + nodes.length * (nodeH + rowGap) - rowGap + zonePadBot;
      const theme = ZONE_THEME[zone] ?? ZONE_THEME.External;

      // Zone background as a non-interactive node (rendered behind component nodes)
      flowNodes.push({
        id: `zone-${zone}`,
        position: { x: zoneX, y: startY },
        data: {
          label: (
            <div
              style={{
                position: "absolute",
                top: 10,
                left: 14,
                fontSize: 11,
                fontWeight: 700,
                color: theme.label,
                opacity: 0.6,
                textTransform: "uppercase" as const,
                letterSpacing: 1.5,
              }}
            >
              {zone}
            </div>
          ),
        },
        selectable: false,
        draggable: false,
        connectable: false,
        style: {
          width: zoneW,
          height: zoneH,
          background: theme.bg,
          border: `1px solid ${theme.border}33`,
          borderRadius: 10,
          zIndex: -1,
          pointerEvents: "none" as const,
          padding: 0,
        },
      });

      nodes.forEach((node, rowIdx) => {
        const threats = graph.annotations.filter(
          (a) => a.attachedTo === node.id,
        );

        flowNodes.push({
          id: node.id,
          position: {
            x: zoneX + zonePadX,
            y: startY + zonePadTop + rowIdx * (nodeH + rowGap),
          },
          data: {
            label: (
              <div style={{ textAlign: "left", lineHeight: 1.35 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      fontWeight: 600,
                      fontSize: 12,
                      color: theme.nodeText,
                    }}
                  >
                    {node.label}
                  </span>
                  <span
                    style={{ fontSize: 9, color: theme.label, opacity: 0.7 }}
                  >
                    {node.id}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: theme.label,
                    opacity: 0.8,
                    marginTop: 2,
                  }}
                >
                  {node.componentType ?? node.type}
                </div>
                {threats.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      gap: 3,
                      marginTop: 4,
                      flexWrap: "wrap",
                    }}
                  >
                    {threats.map((t) => (
                      <span
                        key={t.id}
                        title={`${t.category}: ${t.description}`}
                        style={{
                          fontSize: 8,
                          padding: "1px 5px",
                          borderRadius: 3,
                          background:
                            (STRIDE_COLORS[t.category] ?? "#6b7280") + "22",
                          color: STRIDE_COLORS[t.category] ?? "#9ca3af",
                          border: `1px solid ${STRIDE_COLORS[t.category] ?? "#6b7280"}44`,
                        }}
                      >
                        {t.category
                          .split(" ")
                          .map((w) => w[0])
                          .join("")}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ),
          },
          sourcePosition: Position.Right,
          targetPosition: Position.Left,
          style: {
            background: theme.nodeBg,
            // Components observed running but absent from every repo — an ownership gap, so
            // mark them provisional rather than confirmed.
            border: isUndeclared(node.evidence)
              ? `1.5px dashed ${theme.border}`
              : `1px solid ${theme.border}`,
            boxShadow: isUndeclared(node.evidence)
              ? "0 0 0 3px rgba(249, 115, 22, 0.18)"
              : undefined,
            borderRadius: 8,
            padding: "8px 12px",
            width: nodeW,
            cursor: "pointer",
          },
        });
      });
    });

    // Data flow edges only; styling/emphasis is applied separately based on selection.
    const baseEdges = graph.edges
      .filter((e) => e.type === "data_flow")
      .map((edge) => ({
        edge,
        hasThreat: graph.annotations.some((a) => a.attachedTo === edge.id),
      }));

    return { flowNodes, baseEdges };
  }, [graph]);

  // Fade unrelated edges so the diagram isn't a tangle of overlapping lines.
  // With nothing selected all flows are faint; selecting a node/edge highlights
  // only its connected flows (raised above the boxes) and dims the rest.
  const flowEdges: Edge[] = useMemo(() => {
    const hasSelection = Boolean(selectedNode || selectedEdge);
    // Scale observed edges relative to the busiest flow rather than to an absolute call count,
    // which would make low-traffic projects look uniformly idle.
    const maxCalls = Math.max(
      1,
      ...baseEdges.map(({ edge }) => edge.observedCalls ?? 0),
    );
    return baseEdges.map(({ edge, hasThreat }) => {
      const isConnected = selectedNode
        ? edge.source === selectedNode || edge.target === selectedNode
        : selectedEdge === edge.id;
      const highlight = hasSelection && isConnected;
      const dim = hasSelection && !isConnected;
      const baseColor = hasThreat ? "#f87171" : "#6366f1";
      const stroke = highlight
        ? baseColor
        : dim
          ? "#cbd5e1"
          : hasThreat
            ? "#fca5a5"
            : "#c7d2fe";
      const opacity = highlight ? 0.95 : dim ? 0.06 : 0.3;

      // "code" alone means declared but not seen in the query window — not proof the flow is dead.
      const unobserved = isUnobserved(edge.evidence);
      const observed = !unobserved;
      const weight = observed
        ? 1 + 2.5 * Math.sqrt((edge.observedCalls ?? 0) / maxCalls)
        : 0;

      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: "smoothstep",
        animated: highlight,
        zIndex: highlight ? 1000 : 0,
        style: {
          stroke,
          strokeWidth: highlight
            ? Math.max(2.5, weight)
            : observed
              ? weight
              : hasThreat
                ? 1.5
                : 1,
          strokeDasharray: unobserved ? "5 4" : undefined,
          opacity,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 10,
          height: 10,
          color: stroke,
        },
      };
    });
  }, [baseEdges, selectedNode, selectedEdge]);

  // Detail panel data
  const selectedNodeData = selectedNode
    ? graph.nodes.find((n) => n.id === selectedNode)
    : null;
  const selectedThreats = selectedNode
    ? graph.annotations.filter((a) => a.attachedTo === selectedNode)
    : [];
  const selectedFlows = selectedNode
    ? graph.edges.filter(
        (e) =>
          e.type === "data_flow" &&
          (e.source === selectedNode || e.target === selectedNode),
      )
    : [];
  const selectedEdgeData = selectedEdge
    ? graph.edges.find((e) => e.id === selectedEdge)
    : null;
  const selectedEdgeThreats = selectedEdge
    ? graph.annotations.filter((a) => a.attachedTo === selectedEdge)
    : [];
  const showPanel = selectedNodeData || selectedEdgeData;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 0,
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        overflow: "hidden",
        background: "#ffffff",
        height: "100%",
      }}
    >
      {/* Legend bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 20,
          padding: "10px 16px",
          background: "#f9fafb",
          borderBottom: "1px solid #e5e7eb",
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "#1f2937",
            marginRight: 4,
          }}
        >
          Trust Zones:
        </span>
        {ZONE_ORDER.filter((z) =>
          graph.nodes.some((n) => n.trustZone === z),
        ).map((zone) => {
          const theme = ZONE_THEME[zone];
          return (
            <span
              key={zone}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: 11,
                color: theme.label,
              }}
            >
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 3,
                  background: theme.nodeBg,
                  border: `1.5px solid ${theme.border}`,
                }}
              />
              {zone}
            </span>
          );
        })}
        <span style={{ width: 1, height: 16, background: "#d1d5db" }} />
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            fontSize: 11,
            color: "#4f46e5",
          }}
        >
          <svg width="20" height="10">
            <line
              x1="0"
              y1="5"
              x2="16"
              y2="5"
              stroke="#6366f1"
              strokeWidth="2"
            />
            <polygon points="16,2 20,5 16,8" fill="#6366f1" />
          </svg>
          Data Flow
        </span>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            fontSize: 11,
            color: "#f87171",
          }}
        >
          <svg width="20" height="10">
            <line
              x1="0"
              y1="5"
              x2="16"
              y2="5"
              stroke="#f87171"
              strokeWidth="2"
            />
            <polygon points="16,2 20,5 16,8" fill="#f87171" />
          </svg>
          Flow with Threats
        </span>
        <span style={{ width: 1, height: 16, background: "#d1d5db" }} />
        <span style={{ fontSize: 11, color: "#6b7280" }}>Evidence:</span>
        <span
          title="Observed in Dynatrace during the query window. Line thickness scales with call volume."
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            fontSize: 11,
            color: "#4f46e5",
          }}
        >
          <svg width="20" height="10">
            <line
              x1="0"
              y1="5"
              x2="20"
              y2="5"
              stroke="#6366f1"
              strokeWidth="3"
            />
          </svg>
          Observed
        </span>
        <span
          title="Declared in source but no traffic seen in the query window. Not proof the path is unreachable — it may be seasonal, admin-only, or in an environment that was not mapped."
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            fontSize: 11,
            color: "#6b7280",
          }}
        >
          <svg width="20" height="10">
            <line
              x1="0"
              y1="5"
              x2="20"
              y2="5"
              stroke="#9ca3af"
              strokeWidth="1.5"
              strokeDasharray="5 4"
            />
          </svg>
          Not observed
        </span>
        <span
          title="Running in production but not matched to any repository in this project — an ownership gap to investigate, not confirmed shadow infrastructure."
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            fontSize: 11,
            color: "#c2410c",
          }}
        >
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: 3,
              background: "#fff",
              border: "1.5px dashed #c2410c",
              boxShadow: "0 0 0 3px rgba(249, 115, 22, 0.18)",
            }}
          />
          Runtime only
        </span>
        <span style={{ width: 1, height: 16, background: "#d1d5db" }} />
        <span style={{ fontSize: 11, color: "#6b7280" }}>STRIDE:</span>
        {Object.entries(STRIDE_COLORS).map(([cat, color]) => {
          if (!graph.annotations.some((a) => a.category === cat)) return null;
          return (
            <span
              key={cat}
              style={{
                fontSize: 9,
                padding: "1px 6px",
                borderRadius: 3,
                background: color + "22",
                color,
                border: `1px solid ${color}44`,
              }}
            >
              {cat
                .split(" ")
                .map((w) => w[0])
                .join("")}{" "}
              {cat}
            </span>
          );
        })}
      </div>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* Graph */}
        <div style={{ flex: 1 }}>
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            onNodeClick={(_, node) => {
              setSelectedNode(node.id === selectedNode ? null : node.id);
              setSelectedEdge(null);
            }}
            onEdgeClick={(_, edge) => {
              setSelectedEdge(edge.id === selectedEdge ? null : edge.id);
              setSelectedNode(null);
            }}
            onPaneClick={() => {
              setSelectedNode(null);
              setSelectedEdge(null);
            }}
            fitView
            fitViewOptions={{ padding: 0.15 }}
            proOptions={{ hideAttribution: true }}
            style={{ background: "#ffffff" }}
          >
            <Background color="#e5e7eb" gap={24} size={0.5} />
            <Controls
              position="top-right"
              style={{
                background: "#ffffff",
                borderColor: "#e5e7eb",
                borderRadius: 6,
              }}
            />
            <MiniMap
              nodeColor={(node) => {
                const zone =
                  graph.nodes.find((n) => n.id === node.id)?.trustZone ??
                  "External";
                return (ZONE_THEME[zone] ?? ZONE_THEME.External).border;
              }}
              maskColor="rgba(255,255,255,0.7)"
              style={{
                background: "#ffffff",
                borderColor: "#e5e7eb",
                borderRadius: 6,
              }}
              pannable
              zoomable
            />
          </ReactFlow>
        </div>

        {/* Detail panel */}
        {showPanel && (
          <div
            style={{
              width: 280,
              background: "#f9fafb",
              borderLeft: "1px solid #e5e7eb",
              padding: 16,
              overflowY: "auto",
              fontSize: 12,
            }}
          >
            {selectedNodeData && (
              <>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 12,
                  }}
                >
                  <span
                    style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}
                  >
                    {selectedNodeData.label}
                  </span>
                  <span style={{ fontSize: 10, color: "#6b7280" }}>
                    {selectedNodeData.id}
                  </span>
                </div>

                <div style={{ color: "#6b7280", marginBottom: 8 }}>
                  <div style={{ marginBottom: 6 }}>
                    <EvidenceBadge evidence={selectedNodeData.evidence} />
                  </div>
                  <div>
                    <strong style={{ color: "#374151" }}>Zone:</strong>{" "}
                    {selectedNodeData.trustZone}
                  </div>
                  <div>
                    <strong style={{ color: "#374151" }}>Type:</strong>{" "}
                    {selectedNodeData.componentType ?? selectedNodeData.type}
                  </div>
                  {selectedNodeData.repo && (
                    <div>
                      <strong style={{ color: "#374151" }}>Repo:</strong>{" "}
                      {selectedNodeData.repo}
                    </div>
                  )}
                  {selectedNodeData.dtEntityIds?.length ? (
                    <div
                      title={selectedNodeData.dtEntityIds.join("\n")}
                      style={{ marginTop: 2 }}
                    >
                      <strong style={{ color: "#374151" }}>
                        Dynatrace services:
                      </strong>{" "}
                      {selectedNodeData.dtEntityIds.length}
                      <div style={{ fontSize: 10, color: "#9ca3af" }}>
                        one per environment and blue/green deployment
                      </div>
                    </div>
                  ) : null}
                  {selectedNodeData.description && (
                    <div style={{ marginTop: 6, lineHeight: 1.5 }}>
                      {selectedNodeData.description}
                    </div>
                  )}
                </div>

                {selectedFlows.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        color: "#374151",
                        marginBottom: 6,
                      }}
                    >
                      Data Flows
                    </div>
                    {selectedFlows.map((f) => {
                      const dir = f.source === selectedNode ? "→" : "←";
                      const other =
                        f.source === selectedNode ? f.target : f.source;
                      return (
                        <div
                          key={f.id}
                          style={{
                            padding: "4px 0",
                            borderBottom: "1px solid #e5e7eb",
                            color: "#6b7280",
                          }}
                        >
                          <div>
                            <span style={{ color: "#4f46e5" }}>{f.id}</span>{" "}
                            {dir} {other}
                          </div>
                          {f.label && (
                            <div style={{ fontSize: 10 }}>{f.label}</div>
                          )}
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 5,
                              marginTop: 2,
                            }}
                          >
                            <EvidenceBadge evidence={f.evidence} />
                            {f.observedCalls != null && (
                              <span style={{ fontSize: 10, color: "#9ca3af" }}>
                                {f.observedCalls.toLocaleString()} calls
                              </span>
                            )}
                          </div>
                          {f.assets?.length ? (
                            <div style={{ fontSize: 10, color: "#6b7280" }}>
                              Assets: {f.assets.join(", ")}
                            </div>
                          ) : null}
                          {f.authControl && (
                            <div style={{ fontSize: 10, color: "#6b7280" }}>
                              Auth: {f.authControl}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {selectedThreats.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        color: "#374151",
                        marginBottom: 6,
                      }}
                    >
                      STRIDE Threats
                    </div>
                    {selectedThreats.map((t) => (
                      <div
                        key={t.id}
                        style={{
                          padding: "6px 0",
                          borderBottom: "1px solid #e5e7eb",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 9,
                              padding: "1px 5px",
                              borderRadius: 3,
                              background:
                                (STRIDE_COLORS[t.category] ?? "#6b7280") + "22",
                              color: STRIDE_COLORS[t.category] ?? "#9ca3af",
                              border: `1px solid ${STRIDE_COLORS[t.category] ?? "#6b7280"}44`,
                            }}
                          >
                            {t.category}
                          </span>
                          <span style={{ fontSize: 10, color: "#6b7280" }}>
                            {t.id}
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "#6b7280",
                            marginTop: 3,
                            lineHeight: 1.4,
                          }}
                        >
                          {t.description}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Edge detail (when an edge is clicked) */}
            {selectedEdgeData && (
              <>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 12,
                  }}
                >
                  <span
                    style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}
                  >
                    {selectedEdgeData.id}
                  </span>
                  <span style={{ fontSize: 10, color: "#6b7280" }}>
                    {selectedEdgeData.type}
                  </span>
                </div>
                <div style={{ color: "#6b7280", marginBottom: 8 }}>
                  <div style={{ marginBottom: 6 }}>
                    <EvidenceBadge evidence={selectedEdgeData.evidence} />
                  </div>
                  <div>
                    <strong style={{ color: "#374151" }}>From:</strong>{" "}
                    {selectedEdgeData.source}
                  </div>
                  <div>
                    <strong style={{ color: "#374151" }}>To:</strong>{" "}
                    {selectedEdgeData.target}
                  </div>
                  {selectedEdgeData.label && (
                    <div style={{ marginTop: 4 }}>
                      <strong style={{ color: "#374151" }}>Protocol:</strong>{" "}
                      {selectedEdgeData.label}
                    </div>
                  )}
                  {selectedEdgeData.observedCalls != null && (
                    <div style={{ marginTop: 4 }}>
                      <strong style={{ color: "#374151" }}>
                        Observed calls:
                      </strong>{" "}
                      {selectedEdgeData.observedCalls.toLocaleString()}
                    </div>
                  )}
                  {selectedEdgeData.lastSeen && (
                    <div style={{ marginTop: 4 }}>
                      <strong style={{ color: "#374151" }}>Last seen:</strong>{" "}
                      {new Date(selectedEdgeData.lastSeen).toLocaleString()}
                    </div>
                  )}
                  {selectedEdgeData.assets?.length ? (
                    <div style={{ marginTop: 4 }}>
                      <strong style={{ color: "#374151" }}>Assets:</strong>{" "}
                      {selectedEdgeData.assets.join(", ")}
                    </div>
                  ) : null}
                  {selectedEdgeData.authControl && (
                    <div style={{ marginTop: 4 }}>
                      <strong style={{ color: "#374151" }}>Auth:</strong>{" "}
                      {selectedEdgeData.authControl}
                    </div>
                  )}
                </div>
                {selectedEdgeThreats.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        color: "#374151",
                        marginBottom: 6,
                      }}
                    >
                      STRIDE Threats
                    </div>
                    {selectedEdgeThreats.map((t) => (
                      <div
                        key={t.id}
                        style={{
                          padding: "6px 0",
                          borderBottom: "1px solid #e5e7eb",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 9,
                              padding: "1px 5px",
                              borderRadius: 3,
                              background:
                                (STRIDE_COLORS[t.category] ?? "#6b7280") + "22",
                              color: STRIDE_COLORS[t.category] ?? "#9ca3af",
                              border: `1px solid ${STRIDE_COLORS[t.category] ?? "#6b7280"}44`,
                            }}
                          >
                            {t.category}
                          </span>
                          <span style={{ fontSize: 10, color: "#6b7280" }}>
                            {t.id}
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "#6b7280",
                            marginTop: 3,
                            lineHeight: 1.4,
                          }}
                        >
                          {t.description}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Stats bar */}
      <div
        style={{
          display: "flex",
          gap: 16,
          padding: "8px 16px",
          background: "#f9fafb",
          borderTop: "1px solid #e5e7eb",
          fontSize: 11,
          color: "#6b7280",
        }}
      >
        <span>{graph.nodes.length} components</span>
        <span>
          {graph.edges.filter((e) => e.type === "data_flow").length} data flows
        </span>
        <span>
          {graph.edges.filter((e) => e.type === "trust_boundary").length} trust
          boundaries
        </span>
        <span>{graph.annotations.length} STRIDE threats</span>
      </div>
    </div>
  );
}
