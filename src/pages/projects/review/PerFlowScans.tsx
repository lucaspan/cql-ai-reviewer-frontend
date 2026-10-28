import { useState } from "react";
import { createSecurityScanEntries, startAllSecurityScans } from "../../../api/jobApi";
import type { ProjectKnowledge } from "../../../types/job.types";
import { EntryActions } from "../EntryActions";
import { KnowledgeStatusBadge } from "../KnowledgeStatusBadge";

/**
 * One STRIDE scan per threat-map data flow, with a critic that checks every finding. The
 * review runs them too; here they can be run, or rerun, on their own.
 */
export function PerFlowScans({
  projectId,
  knowledge,
  refresh,
  onView,
  agentLine,
}: {
  projectId: string;
  knowledge: ProjectKnowledge[];
  refresh: () => Promise<void>;
  onView: (id: string) => void;
  agentLine: string | null;
}) {
  const scans = knowledge.filter(
    (k) => k.knowledgeType === "security_scan" && k.key.startsWith("threat_map:"),
  );
  const hasThreatMap = knowledge.some(
    (k) => k.knowledgeType === "threat_map" && k.status === "active",
  );
  const count = (s: ProjectKnowledge["status"]) => scans.filter((x) => x.status === s).length;
  const running = count("collecting");
  const failed = count("failed");
  const waiting = count("pending") + failed;
  const findings = scans.reduce(
    (n, s) => n + (((s.value as { findings?: unknown[] })?.findings ?? []).length),
    0,
  );
  // Open by default while something needs attention
  const [open, setOpen] = useState(() => running > 0 || failed > 0 || scans.length === 0);
  const [starting, setStarting] = useState(false);

  return (
    <section className="pj-section">
      <div className="pj-section__head">
        <button
          className="pj-collapse"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <span className={`pj-collapse__chevron ${open ? "pj-collapse__chevron--open" : ""}`} aria-hidden="true">
            ›
          </span>
          <span>
            <span className="pj-section__title">Per-flow STRIDE Scans</span>
            <span className="pj-hint pj-collapse__summary">
              {scans.length
                ? `${count("active")} of ${scans.length} done · ${findings} finding(s)${running ? ` · ${running} running` : ""}${failed ? ` · ${failed} failed` : ""}`
                : "Not created yet"}
            </span>
          </span>
        </button>
        <div className="pj-row-actions">
          {hasThreatMap && (
            <button
              className="btn btn--secondary btn--sm"
              title="Adds a scan for each data flow that doesn't have one"
              onClick={async () => {
                await createSecurityScanEntries(projectId);
                await refresh();
                setOpen(true);
              }}
            >
              {scans.length ? "Add new flows" : "Create scans"}
            </button>
          )}
          {waiting > 0 && (
            <button
              className="btn btn--primary btn--sm"
              disabled={starting}
              onClick={async () => {
                setStarting(true);
                try {
                  await startAllSecurityScans(projectId);
                } finally {
                  setStarting(false);
                  await refresh();
                }
              }}
            >
              {starting ? "Starting…" : `Run ${waiting} waiting`}
            </button>
          )}
        </div>
      </div>

      {open && (
        <>
          <p className="pj-hint">
            One scan per threat-map data flow, with a critic that checks every finding. A security
            review runs the ones not done yet. The server runs a few agents at a time (Settings →
            Review Agents).
          </p>
          {running > 0 && agentLine && <div className="pj-metrics"><span>{agentLine}</span></div>}
          {scans.length === 0 ? (
            <div className="pj-inline-empty">
              {hasThreatMap
                ? "No scans yet: create them, or start a security review, which creates and runs them."
                : "Build a threat map first."}
            </div>
          ) : (
            <div className="pj-table-wrapper">
              <table className="pj-table pj-table--compact">
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
                    const v = (s.value ?? {}) as {
                      findings?: unknown[];
                      dismissals?: unknown[];
                      flowContext?: { sourceNode?: { label?: string }; targetNode?: { label?: string } };
                    };
                    const f = v.findings?.length ?? 0;
                    const d = v.dismissals?.length ?? 0;
                    const from = v.flowContext?.sourceNode?.label;
                    const to = v.flowContext?.targetNode?.label;
                    return (
                      <tr key={s.id}>
                        <td>
                          <span className="pj-mono">{s.key.replace("threat_map:", "")}</span>
                          {from && to && (
                            <span className="pj-muted">
                              {" "}
                              {from} → {to}
                            </span>
                          )}
                        </td>
                        <td className="pj-col-status">
                          <KnowledgeStatusBadge status={s.status} error={s.error} />
                        </td>
                        <td>
                          {s.status === "active" ? (
                            <>
                              <span className={f ? "pj-text-danger" : "pj-muted"}>{f} finding(s)</span>
                              <span className="pj-muted">, {d} threat(s) ruled out</span>
                            </>
                          ) : (
                            <span className="pj-muted">—</span>
                          )}
                        </td>
                        <td className="pj-actions-cell">
                          <EntryActions
                            projectId={projectId}
                            entry={s}
                            refresh={refresh}
                            onView={onView}
                            rerunLabel="Rescan"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
