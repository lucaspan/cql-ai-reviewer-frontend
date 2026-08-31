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

interface GraphNode {
  id: string;
  type: string;
  label: string;
  trustZone: string;
  componentType?: string;
  description?: string;
}

interface GraphEdge {
  id: string;
  type: string;
  source: string;
  target: string;
  label?: string;
  assets?: string[];
  authControl?: string;
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

const ZONE_THEME: Record<string, { bg: string; border: string; label: string; nodeBg: string; nodeText: string }> = {
  Public:     { bg: "#1a0f0f", border: "#7f1d1d", label: "#fca5a5", nodeBg: "#2d1515", nodeText: "#fecaca" },
  Edge:       { bg: "#1a1708", border: "#78350f", label: "#fcd34d", nodeBg: "#2d2508", nodeText: "#fef3c7" },
  Private:    { bg: "#0c1527", border: "#1e3a5f", label: "#93c5fd", nodeBg: "#0f1d36", nodeText: "#dbeafe" },
  Restricted: { bg: "#140f27", border: "#4c1d95", label: "#c4b5fd", nodeBg: "#1c1436", nodeText: "#ede9fe" },
  External:   { bg: "#141414", border: "#374151", label: "#9ca3af", nodeBg: "#1e1e1e", nodeText: "#e5e7eb" },
};

const STRIDE_COLORS: Record<string, string> = {
  Spoofing: "#f87171",
  Tampering: "#fb923c",
  Repudiation: "#a78bfa",
  "Information Disclosure": "#60a5fa",
  "Denial of Service": "#f472b6",
  "Elevation of Privilege": "#fbbf24",
};

export default function ThreatMapGraph({ graph }: ThreatMapGraphProps) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);

  const { flowNodes, flowEdges, zoneRects } = useMemo(() => {
    // Group nodes by trust zone
    const zoneGroups: Record<string, GraphNode[]> = {};
    for (const node of graph.nodes) {
      const zone = node.trustZone || "External";
      if (!zoneGroups[zone]) zoneGroups[zone] = [];
      zoneGroups[zone].push(node);
    }

    const sortedZones = ZONE_ORDER.filter(z => zoneGroups[z]?.length);
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
      const zoneH = zonePadTop + nodes.length * (nodeH + rowGap) - rowGap + zonePadBot;
      const theme = ZONE_THEME[zone] ?? ZONE_THEME.External;

      // Zone background as a non-interactive node (rendered behind component nodes)
      flowNodes.push({
        id: `zone-${zone}`,
        position: { x: zoneX, y: startY },
        data: {
          label: (
            <div style={{ position: "absolute", top: 10, left: 14, fontSize: 11, fontWeight: 700, color: theme.label, opacity: 0.6, textTransform: "uppercase" as const, letterSpacing: 1.5 }}>
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
        const threats = graph.annotations.filter(a => a.attachedTo === node.id);

        flowNodes.push({
          id: node.id,
          position: {
            x: zoneX + zonePadX,
            y: startY + zonePadTop + rowIdx * (nodeH + rowGap),
          },
          data: {
            label: (
              <div style={{ textAlign: "left", lineHeight: 1.35 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 600, fontSize: 12, color: theme.nodeText }}>{node.label}</span>
                  <span style={{ fontSize: 9, color: theme.label, opacity: 0.7 }}>{node.id}</span>
                </div>
                <div style={{ fontSize: 10, color: theme.label, opacity: 0.8, marginTop: 2 }}>
                  {node.componentType ?? node.type}
                </div>
                {threats.length > 0 && (
                  <div style={{ display: "flex", gap: 3, marginTop: 4, flexWrap: "wrap" }}>
                    {threats.map(t => (
                      <span
                        key={t.id}
                        title={`${t.category}: ${t.description}`}
                        style={{
                          fontSize: 8,
                          padding: "1px 5px",
                          borderRadius: 3,
                          background: (STRIDE_COLORS[t.category] ?? "#6b7280") + "22",
                          color: STRIDE_COLORS[t.category] ?? "#9ca3af",
                          border: `1px solid ${(STRIDE_COLORS[t.category] ?? "#6b7280")}44`,
                        }}
                      >
                        {t.category.split(" ").map(w => w[0]).join("")}
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
            border: `1px solid ${theme.border}`,
            borderRadius: 8,
            padding: "8px 12px",
            width: nodeW,
            cursor: "pointer",
          },
        });
      });
    });

    // Only data flow edges (trust boundaries shown implicitly via zone grouping)
    const flowEdges: Edge[] = graph.edges
      .filter(e => e.type === "data_flow")
      .map((edge) => {
        const threats = graph.annotations.filter(a => a.attachedTo === edge.id);
        return {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          style: {
            stroke: threats.length > 0 ? "#f87171" : "#6366f1",
            strokeWidth: threats.length > 0 ? 2 : 1.5,
            opacity: 0.8,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 10,
            height: 10,
            color: threats.length > 0 ? "#f87171" : "#6366f1",
          },
          type: "smoothstep",
        };
      });

    return { flowNodes, flowEdges };
  }, [graph]);

  // Detail panel data
  const selectedNodeData = selectedNode ? graph.nodes.find(n => n.id === selectedNode) : null;
  const selectedThreats = selectedNode ? graph.annotations.filter(a => a.attachedTo === selectedNode) : [];
  const selectedFlows = selectedNode
    ? graph.edges.filter(e => e.type === "data_flow" && (e.source === selectedNode || e.target === selectedNode))
    : [];
  const selectedEdgeData = selectedEdge ? graph.edges.find(e => e.id === selectedEdge) : null;
  const selectedEdgeThreats = selectedEdge ? graph.annotations.filter(a => a.attachedTo === selectedEdge) : [];
  const showPanel = selectedNodeData || selectedEdgeData;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, border: "1px solid #1f2937", borderRadius: 10, overflow: "hidden", background: "#0a0a0a", height: "100%" }}>
      {/* Legend bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "10px 16px", background: "#111827", borderBottom: "1px solid #1f2937", flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#e5e7eb", marginRight: 4 }}>Trust Zones:</span>
        {ZONE_ORDER.filter(z => graph.nodes.some(n => n.trustZone === z)).map(zone => {
          const theme = ZONE_THEME[zone];
          return (
            <span key={zone} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: theme.label }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: theme.nodeBg, border: `1.5px solid ${theme.border}` }} />
              {zone}
            </span>
          );
        })}
        <span style={{ width: 1, height: 16, background: "#374151" }} />
        <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#818cf8" }}>
          <svg width="20" height="10"><line x1="0" y1="5" x2="16" y2="5" stroke="#6366f1" strokeWidth="2"/><polygon points="16,2 20,5 16,8" fill="#6366f1"/></svg>
          Data Flow
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#f87171" }}>
          <svg width="20" height="10"><line x1="0" y1="5" x2="16" y2="5" stroke="#f87171" strokeWidth="2"/><polygon points="16,2 20,5 16,8" fill="#f87171"/></svg>
          Flow with Threats
        </span>
        <span style={{ width: 1, height: 16, background: "#374151" }} />
        <span style={{ fontSize: 11, color: "#6b7280" }}>STRIDE:</span>
        {Object.entries(STRIDE_COLORS).map(([cat, color]) => {
          if (!graph.annotations.some(a => a.category === cat)) return null;
          return (
            <span key={cat} style={{ fontSize: 9, padding: "1px 6px", borderRadius: 3, background: color + "22", color, border: `1px solid ${color}44` }}>
              {cat.split(" ").map(w => w[0]).join("")} {cat}
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
            onNodeClick={(_, node) => { setSelectedNode(node.id === selectedNode ? null : node.id); setSelectedEdge(null); }}
            onEdgeClick={(_, edge) => { setSelectedEdge(edge.id === selectedEdge ? null : edge.id); setSelectedNode(null); }}
            onPaneClick={() => { setSelectedNode(null); setSelectedEdge(null); }}
            fitView
            fitViewOptions={{ padding: 0.15 }}
            proOptions={{ hideAttribution: true }}
            style={{ background: "transparent" }}
          >
            <Background color="#1f2937" gap={24} size={0.5} />
            <Controls
              position="top-right"
              style={{ background: "#1f2937", borderColor: "#374151", borderRadius: 6 }}
            />
            <MiniMap
              nodeColor={(node) => {
                const zone = graph.nodes.find(n => n.id === node.id)?.trustZone ?? "External";
                return (ZONE_THEME[zone] ?? ZONE_THEME.External).border;
              }}
              maskColor="rgba(0,0,0,0.7)"
              style={{ background: "#0a0a0a", borderColor: "#1f2937", borderRadius: 6 }}
              pannable
              zoomable
            />
          </ReactFlow>
        </div>

        {/* Detail panel */}
        {showPanel && (
          <div style={{ width: 280, background: "#111827", borderLeft: "1px solid #1f2937", padding: 16, overflowY: "auto", fontSize: 12 }}>
            {selectedNodeData && (<>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: "#f9fafb" }}>{selectedNodeData.label}</span>
              <span style={{ fontSize: 10, color: "#6b7280" }}>{selectedNodeData.id}</span>
            </div>

            <div style={{ color: "#9ca3af", marginBottom: 8 }}>
              <div><strong style={{ color: "#d1d5db" }}>Zone:</strong> {selectedNodeData.trustZone}</div>
              <div><strong style={{ color: "#d1d5db" }}>Type:</strong> {selectedNodeData.componentType ?? selectedNodeData.type}</div>
              {selectedNodeData.description && (
                <div style={{ marginTop: 6, lineHeight: 1.5 }}>{selectedNodeData.description}</div>
              )}
            </div>

            {selectedFlows.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 600, color: "#d1d5db", marginBottom: 6 }}>Data Flows</div>
                {selectedFlows.map(f => {
                  const dir = f.source === selectedNode ? "→" : "←";
                  const other = f.source === selectedNode ? f.target : f.source;
                  return (
                    <div key={f.id} style={{ padding: "4px 0", borderBottom: "1px solid #1f2937", color: "#9ca3af" }}>
                      <div><span style={{ color: "#818cf8" }}>{f.id}</span> {dir} {other}</div>
                      {f.label && <div style={{ fontSize: 10 }}>{f.label}</div>}
                      {f.assets?.length ? <div style={{ fontSize: 10, color: "#6b7280" }}>Assets: {f.assets.join(", ")}</div> : null}
                      {f.authControl && <div style={{ fontSize: 10, color: "#6b7280" }}>Auth: {f.authControl}</div>}
                    </div>
                  );
                })}
              </div>
            )}

            {selectedThreats.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 600, color: "#d1d5db", marginBottom: 6 }}>STRIDE Threats</div>
                {selectedThreats.map(t => (
                  <div key={t.id} style={{ padding: "6px 0", borderBottom: "1px solid #1f2937" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{
                        fontSize: 9, padding: "1px 5px", borderRadius: 3,
                        background: (STRIDE_COLORS[t.category] ?? "#6b7280") + "22",
                        color: STRIDE_COLORS[t.category] ?? "#9ca3af",
                        border: `1px solid ${(STRIDE_COLORS[t.category] ?? "#6b7280")}44`,
                      }}>
                        {t.category}
                      </span>
                      <span style={{ fontSize: 10, color: "#6b7280" }}>{t.id}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 3, lineHeight: 1.4 }}>{t.description}</div>
                  </div>
                ))}
              </div>
            )}
            </>)}

            {/* Edge detail (when an edge is clicked) */}
            {selectedEdgeData && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: "#f9fafb" }}>{selectedEdgeData.id}</span>
                  <span style={{ fontSize: 10, color: "#6b7280" }}>{selectedEdgeData.type}</span>
                </div>
                <div style={{ color: "#9ca3af", marginBottom: 8 }}>
                  <div><strong style={{ color: "#d1d5db" }}>From:</strong> {selectedEdgeData.source}</div>
                  <div><strong style={{ color: "#d1d5db" }}>To:</strong> {selectedEdgeData.target}</div>
                  {selectedEdgeData.label && <div style={{ marginTop: 4 }}><strong style={{ color: "#d1d5db" }}>Protocol:</strong> {selectedEdgeData.label}</div>}
                  {selectedEdgeData.assets?.length ? <div style={{ marginTop: 4 }}><strong style={{ color: "#d1d5db" }}>Assets:</strong> {selectedEdgeData.assets.join(", ")}</div> : null}
                  {selectedEdgeData.authControl && <div style={{ marginTop: 4 }}><strong style={{ color: "#d1d5db" }}>Auth:</strong> {selectedEdgeData.authControl}</div>}
                </div>
                {selectedEdgeThreats.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontWeight: 600, color: "#d1d5db", marginBottom: 6 }}>STRIDE Threats</div>
                    {selectedEdgeThreats.map(t => (
                      <div key={t.id} style={{ padding: "6px 0", borderBottom: "1px solid #1f2937" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{
                            fontSize: 9, padding: "1px 5px", borderRadius: 3,
                            background: (STRIDE_COLORS[t.category] ?? "#6b7280") + "22",
                            color: STRIDE_COLORS[t.category] ?? "#9ca3af",
                            border: `1px solid ${(STRIDE_COLORS[t.category] ?? "#6b7280")}44`,
                          }}>
                            {t.category}
                          </span>
                          <span style={{ fontSize: 10, color: "#6b7280" }}>{t.id}</span>
                        </div>
                        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 3, lineHeight: 1.4 }}>{t.description}</div>
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
      <div style={{ display: "flex", gap: 16, padding: "8px 16px", background: "#111827", borderTop: "1px solid #1f2937", fontSize: 11, color: "#6b7280" }}>
        <span>{graph.nodes.length} components</span>
        <span>{graph.edges.filter(e => e.type === "data_flow").length} data flows</span>
        <span>{graph.edges.filter(e => e.type === "trust_boundary").length} trust boundaries</span>
        <span>{graph.annotations.length} STRIDE threats</span>
      </div>
    </div>
  );
}
