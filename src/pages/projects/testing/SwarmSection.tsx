import {
  deleteProjectKnowledge,
  startPentestSwarm,
  stopPentestSwarm,
} from "../../../api/jobApi";
import type {
  ProjectKnowledge,
} from "../../../types/job.types";

export function SwarmSection({
  projectId, swarms, knowledge, swarmConfig, setSwarmConfig, swarmStarting, setSwarmStarting, refresh, setViewingKnowledgeId,
}: {
  projectId: string;
  swarms: ProjectKnowledge[];
  knowledge: ProjectKnowledge[];
  swarmConfig: { maxTokens: number; maxSpecialists: number; maxDurationMinutes: number };
  setSwarmConfig: React.Dispatch<React.SetStateAction<{ maxTokens: number; maxSpecialists: number; maxDurationMinutes: number }>>;
  swarmStarting: boolean;
  setSwarmStarting: React.Dispatch<React.SetStateAction<boolean>>;
  refresh: () => Promise<void>;
  setViewingKnowledgeId: (id: string) => void;
}) {
  // The page refreshes every 5 s while a swarm runs
  const displaySwarms = swarms;
  const latest = displaySwarms[0];
  const latestVal = latest?.value as any;
  const latestSpecs = latestVal?.specialists ?? [];
  const latestPlan = latestVal?.plan;
  const latestCoverage = latestVal?.coverageSummary;
  const isLatestRunning = latest?.status === "collecting";


  const inputStyle: React.CSSProperties = { width: 64, marginLeft: 4, fontSize: 11, padding: "2px 4px", border: "1px solid #d1d5db", borderRadius: 4 };

  return (
    <section className="pj-section">
      <div className="pj-section__head">
        <h3 className="pj-section__title">Pentest Swarm</h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ fontSize: 11, color: "#6b7280" }}>Specialists
            <input type="number" min={2} max={20} value={swarmConfig.maxSpecialists}
              onChange={e => setSwarmConfig(c => ({ ...c, maxSpecialists: +e.target.value }))} style={inputStyle} />
          </label>
          <label style={{ fontSize: 11, color: "#6b7280" }}>Tokens
            <input type="number" min={100000} step={100000} value={swarmConfig.maxTokens}
              onChange={e => setSwarmConfig(c => ({ ...c, maxTokens: +e.target.value }))} style={{ ...inputStyle, width: 80 }} />
          </label>
          <label style={{ fontSize: 11, color: "#6b7280" }}>Min
            <input type="number" min={5} max={180} value={swarmConfig.maxDurationMinutes}
              onChange={e => setSwarmConfig(c => ({ ...c, maxDurationMinutes: +e.target.value }))} style={inputStyle} />
          </label>
          <button
            className="btn btn--primary btn--sm"
            disabled={swarmStarting || !knowledge.some(k => k.knowledgeType === "test_environment" && k.status === "active")}
            title={!knowledge.some(k => k.knowledgeType === "test_environment" && k.status === "active") ? "Configure test environment first" : "Launch autonomous pentest swarm"}
            onClick={async () => {
              setSwarmStarting(true);
              try { await startPentestSwarm(projectId, swarmConfig); await refresh(); } finally { setSwarmStarting(false); }
            }}
          >
            {swarmStarting ? "Starting..." : "Launch Swarm"}
          </button>
        </div>
      </div>

      {displaySwarms.length === 0 ? (
        <div className="pj-muted" style={{ fontSize: 13, padding: "8px 0" }}>
          No swarm runs yet. Launch a swarm to autonomously discover vulnerabilities.
        </div>
      ) : (
        <div>
          {/* Swarm runs table */}
          <div className="pj-table-wrapper">
            <table className="pj-table">
              <thead>
                <tr><th>Run</th><th>Status</th><th>Specialists</th><th>Findings</th><th>Tokens</th><th></th></tr>
              </thead>
              <tbody>
                {displaySwarms.map((sw) => {
                  const v = sw.value as any;
                  const b = v.budget ?? {};
                  const specs = v.specialists ?? [];
                  const findingCount = v.findings?.length ?? 0;
                  const isRunning = sw.status === "collecting";
                  const statusPill = sw.status === "active"
                    ? "pj-pill--resolved"
                    : sw.status === "failed" ? "pj-pill--critical"
                    : sw.status === "collecting" ? "" : "pj-pill--muted";
                  const pct = b.maxTokens ? Math.min(100, Math.round(((b.tokensUsed ?? 0) / b.maxTokens) * 100)) : 0;

                  return (
                    <tr key={sw.id}>
                      <td>
                        <div style={{ fontSize: 13 }}>{sw.key}</div>
                        <div style={{ fontSize: 11, color: "#6b7280" }}>
                          {b.startedAt ? new Date(b.startedAt).toLocaleString() : "—"}
                        </div>
                      </td>
                      <td>
                        <span className={`pj-pill ${statusPill}`}>{sw.status}</span>
                        {isRunning && <span style={{ fontSize: 10, color: "#6366f1", marginLeft: 4 }}>auto-refreshing</span>}
                      </td>
                      <td>
                        <div style={{ fontSize: 13 }}>{specs.length} / {b.maxSpecialists ?? "?"}</div>
                        <div style={{ fontSize: 11, color: "#6b7280" }}>
                          {specs.filter((s: any) => s.status === "completed").length} done
                          {specs.some((s: any) => s.status === "running") ? ", 1 running" : ""}
                        </div>
                      </td>
                      <td style={{ fontSize: 13 }}>{findingCount}</td>
                      <td>
                        <div style={{ fontSize: 13 }}>{(b.tokensUsed ?? 0).toLocaleString()}</div>
                        <div style={{ background: "#e5e7eb", borderRadius: 4, height: 4, width: 60, marginTop: 2 }}>
                          <div style={{ background: pct > 80 ? "#dc2626" : "#6366f1", borderRadius: 4, height: 4, width: `${pct}%` }} />
                        </div>
                        <div style={{ fontSize: 10, color: "#6b7280" }}>{pct}% of {(b.maxTokens ?? 0).toLocaleString()}</div>
                      </td>
                      <td className="pj-actions-cell">
                        {isRunning && (
                          <button className="btn btn--danger btn--sm" onClick={async () => { await stopPentestSwarm(projectId, sw.id); await refresh(); }}>Stop</button>
                        )}
                        <button className="btn btn--secondary btn--sm" onClick={() => setViewingKnowledgeId(sw.id)}>View</button>
                        {!isRunning && <button className="btn btn--danger btn--sm" onClick={async () => { if (!confirm("Delete this swarm run?")) return; await deleteProjectKnowledge(projectId, sw.id); await refresh(); }}>✕</button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Latest swarm detail panel */}
          {latest && latestSpecs.length > 0 && (
            <div style={{ marginTop: 16, border: "1px solid #e5e7eb", borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "#111827" }}>
                {latest.key} {isLatestRunning && <span style={{ fontSize: 11, color: "#6366f1", fontWeight: 400 }}>(live)</span>}
              </div>

              {/* Attack Plan */}
              {latestPlan?.markdown && (
                <details open={isLatestRunning} style={{ marginBottom: 12 }}>
                  <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#374151" }}>Attack Plan</summary>
                  <div style={{ fontSize: 11, color: "#374151", whiteSpace: "pre-wrap", padding: "8px 0 4px 8px", maxHeight: 200, overflow: "auto", background: "#f9fafb", borderRadius: 4, marginTop: 4 }}>
                    {latestPlan.markdown}
                  </div>
                </details>
              )}

              {/* Coverage Summary */}
              {latestCoverage && (
                <details style={{ marginBottom: 12 }}>
                  <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#374151" }}>Coverage Summary</summary>
                  <div style={{ fontSize: 11, color: "#374151", whiteSpace: "pre-wrap", padding: "8px 0 4px 8px" }}>
                    {latestCoverage}
                  </div>
                </details>
              )}

              {/* Discovered Endpoints */}
              {latestPlan?.discoveredEndpoints?.length > 0 && (
                <details style={{ marginBottom: 12 }}>
                  <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#374151" }}>
                    Discovered Endpoints ({latestPlan.discoveredEndpoints.length})
                  </summary>
                  <div style={{ fontSize: 11, color: "#6b7280", padding: "8px 0 4px 8px", maxHeight: 150, overflow: "auto" }}>
                    {latestPlan.discoveredEndpoints.map((ep: string, i: number) => (
                      <div key={i} className="pj-mono">{ep}</div>
                    ))}
                  </div>
                </details>
              )}

              {/* Specialists table */}
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: "#374151" }}>Specialists</div>
              <table className="pj-table">
                <thead>
                  <tr><th>ID</th><th>Scope</th><th>Status</th><th>Findings</th><th>Tokens</th></tr>
                </thead>
                <tbody>
                  {latestSpecs.map((s: any) => (
                    <tr key={s.id} style={s.status === "running" ? { background: "#eef2ff" } : undefined}>
                      <td className="pj-mono" style={{ fontSize: 11 }}>{s.id}</td>
                      <td style={{ fontSize: 12, maxWidth: 300 }}>{s.scope}</td>
                      <td>
                        <span className={`pj-pill ${s.status === "completed" ? "pj-pill--resolved" : s.status === "failed" ? "pj-pill--critical" : s.status === "running" ? "" : "pj-pill--muted"}`}>
                          {s.status}
                        </span>
                      </td>
                      <td style={{ fontSize: 13 }}>{s.findingsCount ?? 0}</td>
                      <td style={{ fontSize: 12 }}>{(s.tokensUsed ?? 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Specialist summaries (expandable) */}
              {latestSpecs.some((s: any) => s.summary) && (
                <div style={{ marginTop: 8 }}>
                  {latestSpecs.filter((s: any) => s.summary).map((s: any) => (
                    <details key={s.id} style={{ marginBottom: 4 }}>
                      <summary style={{ cursor: "pointer", fontSize: 12, color: "#374151" }}>
                        <span className="pj-mono" style={{ fontSize: 11 }}>{s.id}</span> {s.scope}
                        {s.findingsCount > 0 && <span style={{ color: "#dc2626", marginLeft: 4 }}>({s.findingsCount} findings)</span>}
                      </summary>
                      <div style={{ fontSize: 11, color: "#6b7280", whiteSpace: "pre-wrap", padding: "4px 0 4px 16px", maxHeight: 200, overflow: "auto" }}>
                        {s.summary}
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
