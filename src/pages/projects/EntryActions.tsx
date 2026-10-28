import {
  deleteProjectKnowledge,
  resetProjectKnowledge,
  startKnowledgeCollection,
} from "../../api/jobApi";
import type { ProjectKnowledge } from "../../types/job.types";

/** A small "x" for delete buttons (an SVG, so it renders the same everywhere). */
export function IconX() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M2.5 2.5l7 7m0-7l-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/**
 * The actions on one knowledge entry: run it (or run it again), reset a run that is stuck,
 * view it, delete it. Only a run that hasn't happened yet is a primary button.
 */
export function EntryActions({
  projectId,
  entry,
  refresh,
  onView,
  runLabel = "Start",
  rerunLabel = "Regenerate",
  deleteMessage = "Delete this entry and its history?",
}: {
  projectId: string;
  entry: ProjectKnowledge;
  refresh: () => Promise<void>;
  onView: (id: string) => void;
  runLabel?: string;
  rerunLabel?: string;
  deleteMessage?: string;
}) {
  const run = async () => {
    await startKnowledgeCollection(projectId, entry.id);
    await refresh();
  };
  return (
    <div className="pj-row-actions">
      {(entry.status === "pending" || entry.status === "failed") && (
        <button className="btn btn--primary btn--sm" onClick={run}>
          {entry.status === "failed" ? "Retry" : runLabel}
        </button>
      )}
      {entry.status === "active" && (
        <button className="btn btn--secondary btn--sm" onClick={run}>
          {rerunLabel}
        </button>
      )}
      {entry.status === "collecting" && (
        <button
          className="btn btn--secondary btn--sm"
          title="Mark a run that stopped reporting as failed, so it can be started again"
          onClick={async () => {
            await resetProjectKnowledge(projectId, entry.id);
            await refresh();
          }}
        >
          Reset
        </button>
      )}
      <button className="btn btn--secondary btn--sm" onClick={() => onView(entry.id)}>
        View
      </button>
      <button
        className="pj-icon-btn"
        aria-label={`Delete ${entry.key}`}
        title="Delete"
        disabled={entry.status === "collecting"}
        onClick={async () => {
          if (!confirm(deleteMessage)) return;
          await deleteProjectKnowledge(projectId, entry.id);
          await refresh();
        }}
      >
        <IconX />
      </button>
    </div>
  );
}
