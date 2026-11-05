import { useEffect, useState } from "react";
import { getAgentWorkQueue } from "../api/jobApi";

type QueueSnapshot = { running: number; queued: number; blocked: number; limit: number };

/**
 * Compact, auto-refreshing indicator of the unified agent-work queue (fleet-wide, from the shared
 * DB): how many items are running vs the concurrency cap, plus queued and (if any) blocked. Renders
 * nothing until the first successful read, and on any error (the endpoint is best-effort here).
 */
export default function AgentQueueStatus() {
  const [q, setQ] = useState<QueueSnapshot | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      getAgentWorkQueue()
        .then((s) => alive && setQ(s))
        .catch(() => alive && setQ(null));
    load();
    const id = setInterval(load, 8000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  if (!q) return null;
  const active = q.running > 0 || q.queued > 0 || q.blocked > 0;
  return (
    <span
      title="Unified agent-work queue (fleet-wide): running / queued / blocked, and the concurrency cap"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12,
        color: "var(--text-muted, #6b7280)",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: active ? "#f59e0b" : "#9ca3af",
          display: "inline-block",
        }}
      />
      Queue {q.running}/{q.limit} running · {q.queued} queued
      {q.blocked ? ` · ${q.blocked} blocked` : ""}
    </span>
  );
}
