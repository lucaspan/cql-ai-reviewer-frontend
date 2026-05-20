import type { GithubReviewJobActivity } from "../types/job.types";
import "./Modal.css";
import "./ActivityModal.css";

interface ActivityModalProps {
  jobId: string;
  activities: GithubReviewJobActivity[];
  loading: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export default function ActivityModal({
  jobId,
  activities,
  loading,
  onClose,
  onRefresh,
}: ActivityModalProps) {
  const levelClass = (level?: string) => {
    const l = level?.toLowerCase() ?? "info";
    return `activity-level activity-level--${l}`;
  };

  const itemClass = (level?: string) => {
    const l = level?.toLowerCase() ?? "info";
    return `activity-item activity-item--${l}`;
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <div>
            <h2 className="modal__title">Activity Log</h2>
            <p className="modal__subtitle">
              Job: <code>{jobId}</code>
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button
              className="btn btn--secondary btn--sm activity-modal-refresh"
              onClick={onRefresh}
              disabled={loading}
            >
              {loading ? "..." : "↻ Refresh"}
            </button>
            <button className="modal__close" onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        <div className="modal__body">
          {loading && <div className="modal-state">Loading activities...</div>}

          {!loading && activities.length === 0 && (
            <div className="modal-state">No activity found for this job</div>
          )}

          {!loading && activities.length > 0 && (
            <div className="activity-list">
              {activities.map((activity, i) => (
                <div
                  key={activity.id ?? i}
                  className={itemClass(activity.level)}
                >
                  <div className="activity-item__header">
                    <span className={levelClass(activity.level)}>
                      {activity.level ?? "INFO"}
                    </span>
                    <span className="activity-item__time">
                      {new Date(activity.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="activity-item__message">{activity.message}</p>
                  {activity.metadata && (
                    <pre className="activity-item__metadata">
                      {JSON.stringify(activity.metadata, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
