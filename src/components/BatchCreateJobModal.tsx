import { useState, useRef, useEffect } from "react";
import { createJob } from "../api/jobApi";
import "./Modal.css";
import "./CreateJobModal.css";
import "./BatchCreateJobModal.css";

interface BatchCreateJobModalProps {
  onClose: () => void;
  onDone: (created: number, failed: number) => void;
}

type ItemStatus = "pending" | "running" | "success" | "error";

interface BatchItem {
  repo: string;
  status: ItemStatus;
  msg?: string;
}

const ICON: Record<ItemStatus, string> = {
  pending: "·",
  running: "⏳",
  success: "✓",
  error: "✕",
};

export default function BatchCreateJobModal({
  onClose,
  onDone,
}: BatchCreateJobModalProps) {
  const [owner, setOwner] = useState("BMO-Prod");
  const [branch, setBranch] = useState("master");
  const [text, setText] = useState("");
  const [items, setItems] = useState<BatchItem[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef(false);

  const repos = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  useEffect(() => {
    if (progressRef.current) {
      progressRef.current.scrollTop = progressRef.current.scrollHeight;
    }
  }, [items]);

  const handleStart = async () => {
    if (!repos.length) return;
    abortRef.current = false;
    setRunning(true);
    setDone(false);
    setItems(repos.map((repo) => ({ repo, status: "pending" })));

    let ok = 0;
    let fail = 0;

    for (let i = 0; i < repos.length; i++) {
      if (abortRef.current) break;
      const repo = repos[i];

      setItems((prev) =>
        prev.map((it, idx) => (idx === i ? { ...it, status: "running" } : it)),
      );

      try {
        const result = await createJob({
          githubOwner: owner,
          githubRepo: repo,
          githubBranch: branch,
        });
        if (result.created) {
          ok++;
          setItems((prev) =>
            prev.map((it, idx) =>
              idx === i
                ? {
                    ...it,
                    status: "success",
                    msg: result.jobId?.slice(0, 8) + "…",
                  }
                : it,
            ),
          );
        } else {
          fail++;
          setItems((prev) =>
            prev.map((it, idx) =>
              idx === i
                ? { ...it, status: "error", msg: result.error ?? "failed" }
                : it,
            ),
          );
        }
      } catch (err) {
        fail++;
        setItems((prev) =>
          prev.map((it, idx) =>
            idx === i
              ? {
                  ...it,
                  status: "error",
                  msg: (err as Error).message.slice(0, 40),
                }
              : it,
          ),
        );
      }
    }

    setRunning(false);
    setDone(true);
    onDone(ok, fail);
  };

  return (
    <div className="modal-backdrop" onClick={!running ? onClose : undefined}>
      <div className="modal modal--sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <div>
            <h2 className="modal__title">Batch Create Jobs</h2>
            <p className="modal__subtitle">
              One repo per line — same owner &amp; branch for all
            </p>
          </div>
          {!running && (
            <button className="modal__close" onClick={onClose}>
              ✕
            </button>
          )}
        </div>

        <div className="modal__body">
          {!running && !done && (
            <div className="batch-form">
              <div className="batch-row">
                <div className="form-field">
                  <label className="form-label">Owner</label>
                  <input
                    className="form-input"
                    value={owner}
                    onChange={(e) => setOwner(e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Branch</label>
                  <input
                    className="form-input"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-field">
                <label className="form-label">Repositories</label>
                <textarea
                  className="batch-textarea"
                  placeholder={`LAU_fingerprint_api_20663\nLAU_product_api_20663\nLAU_device_register_api_20663\n…`}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  spellCheck={false}
                />
              </div>

              {repos.length > 0 && (
                <p className="batch-preview">
                  <strong>{repos.length}</strong> repo
                  {repos.length !== 1 ? "s" : ""} will be created
                </p>
              )}
            </div>
          )}

          {(running || done) && (
            <>
              <div className="batch-progress" ref={progressRef}>
                {items.map((item, i) => (
                  <div
                    key={i}
                    className={`batch-progress-item batch-progress-item--${item.status}`}
                  >
                    <span className="batch-progress-icon">
                      {ICON[item.status]}
                    </span>
                    <span className="batch-progress-repo" title={item.repo}>
                      {item.repo}
                    </span>
                    {item.msg && (
                      <span className="batch-progress-msg">{item.msg}</span>
                    )}
                  </div>
                ))}
              </div>

              {done && (
                <div className="batch-summary">
                  <span className="batch-summary__ok">
                    ✓ {items.filter((i) => i.status === "success").length}{" "}
                    created
                  </span>
                  <span className="batch-summary__fail">
                    ✕ {items.filter((i) => i.status === "error").length} failed
                  </span>
                  {items.filter((i) => i.status === "pending").length > 0 && (
                    <span
                      style={{
                        color: "#9ca3af",
                        marginLeft: "auto",
                        fontSize: 12,
                      }}
                    >
                      {items.filter((i) => i.status === "pending").length}{" "}
                      cancelled
                    </span>
                  )}
                </div>
              )}
            </>
          )}

          <div className="modal__footer">
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => {
                if (running) {
                  abortRef.current = true;
                } else {
                  onClose();
                }
              }}
            >
              {running ? "⏹ Abort" : done ? "Close" : "Cancel"}
            </button>
            {!running && !done && (
              <button
                type="button"
                className="btn btn--primary"
                onClick={handleStart}
                disabled={repos.length === 0 || !owner || !branch}
              >
                Create {repos.length > 0 ? repos.length : ""} Job
                {repos.length !== 1 ? "s" : ""}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
