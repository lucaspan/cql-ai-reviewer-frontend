import type { AgentItem, AgentOverview } from "../types/job.types";
import StatusBadge from "../components/StatusBadge";
import "./JobsPage.css";
import "./AgentsPage.css";

const KIND_LABEL: Record<AgentItem["kind"], string> = {
  job: "Job",
  commit: "Commit",
  knowledge: "Threat Model",
};

/** Every agent in one place: what is in progress and queued across all flows, with a link to each. */
export default function AgentsPage({
  overview,
  error,
  onOpen,
}: {
  overview: AgentOverview | null;
  error: string | null;
  onOpen: (item: AgentItem) => void;
}) {
  const items = overview?.items ?? [];
  const queuedListed = items.filter((item) => item.status === "queued").length;
  const queuedHidden = (overview?.queued ?? 0) - queuedListed;

  return (
    <div className="agents-page">
      {overview && (
        <p className="agents-page__summary">
          <strong>
            {overview.running}/{overview.limit}
          </strong>{" "}
          running · {overview.queued} queued
        </p>
      )}
      {error && (
        <p className="agents-page__error" role="alert">
          Could not refresh: {error}
        </p>
      )}

      <div className="jobs-table-wrapper">
        <table className="jobs-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Task</th>
              <th>Status</th>
              <th>Started</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={4} className="table-state">
                  {overview || error ? "No agents running or queued." : "Loading…"}
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id}>
                  <td>{KIND_LABEL[item.kind]}</td>
                  <td>
                    <button className="agents-page__link" onClick={() => onOpen(item)}>
                      {item.title}
                    </button>
                  </td>
                  <td>
                    <StatusBadge status={item.status} />
                  </td>
                  <td>{item.startedAt ? new Date(item.startedAt).toLocaleString() : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {queuedHidden > 0 && (
        <p className="agents-page__hint">{queuedHidden} more queued item(s) not shown.</p>
      )}
      <p className="agents-page__hint">
        Queued items are waiting for an agent slot. In progress can be more than the running count:
        it includes items preparing to run or waiting for their subtasks. Follow-up passes count in
        the totals but aren't listed.
      </p>
    </div>
  );
}
