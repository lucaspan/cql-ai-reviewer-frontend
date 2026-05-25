import { useState, useRef, useEffect } from "react";
import { createJob, getJobTypes } from "../api/jobApi";
import type { ReviewJobType } from "../types/job.types";
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
  branch: string;
  jobType: string;
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
  const [text, setText] = useState("");
  const [jobTypes, setJobTypes] = useState<ReviewJobType[]>([]);
  const [selectedJobTypes, setSelectedJobTypes] = useState<string[]>([]);
  const [items, setItems] = useState<BatchItem[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef(false);

  useEffect(() => {
    getJobTypes()
      .then((types) => {
        setJobTypes(types);
        if (types.length > 0 && selectedJobTypes.length === 0) {
          setSelectedJobTypes([types[0].id]);
        }
      })
      .catch(() => {});
  }, []);

  const parsedLines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\s+/);
      return { repo: parts[0], branch: parts[1] || "master" };
    });

  useEffect(() => {
    if (progressRef.current) {
      progressRef.current.scrollTop = progressRef.current.scrollHeight;
    }
  }, [items]);

  const toggleJobType = (id: string) => {
    setSelectedJobTypes((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );
  };

  const totalJobs = parsedLines.length * selectedJobTypes.length;

  const handleStart = async () => {
    if (!parsedLines.length || !selectedJobTypes.length) return;
    abortRef.current = false;
    setRunning(true);
    setDone(false);

    const allItems: BatchItem[] = [];
    for (const line of parsedLines) {
      for (const jt of selectedJobTypes) {
        allItems.push({
          repo: line.repo,
          branch: line.branch,
          jobType: jt,
          status: "pending",
        });
      }
    }
    setItems(allItems);

    let ok = 0;
    let fail = 0;

    for (let i = 0; i < allItems.length; i++) {
      if (abortRef.current) break;
      const item = allItems[i];

      setItems((prev) =>
        prev.map((it, idx) => (idx === i ? { ...it, status: "running" } : it)),
      );

      try {
        const result = await createJob({
          githubOwner: owner,
          githubRepo: item.repo,
          githubBranch: item.branch,
          reviewJobType: item.jobType,
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
              One entry per line: repo branch (branch defaults to master)
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
              </div>

              <div className="form-field">
                <label className="form-label">Job Types</label>
                <div className="batch-job-types">
                  {jobTypes.map((jt) => (
                    <label key={jt.id} className="batch-job-type-chip">
                      <input
                        type="checkbox"
                        checked={selectedJobTypes.includes(jt.id)}
                        onChange={() => toggleJobType(jt.id)}
                      />
                      <span>{jt.id}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-field">
                <label className="form-label">Repositories</label>
                <textarea
                  className="batch-textarea"
                  placeholder={`my-repo master\nother-repo develop\nthird-repo`}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  spellCheck={false}
                />
              </div>

              {parsedLines.length > 0 && (
                <p className="batch-preview">
                  <strong>{totalJobs}</strong> job
                  {totalJobs !== 1 ? "s" : ""} will be created (
                  {parsedLines.length} repo
                  {parsedLines.length !== 1 ? "s" : ""} x{" "}
                  {selectedJobTypes.length} type
                  {selectedJobTypes.length !== 1 ? "s" : ""})
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
                    <span className="batch-progress-branch">
                      {item.branch}
                    </span>
                    <span className="batch-progress-type">{item.jobType}</span>
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
                disabled={
                  parsedLines.length === 0 ||
                  selectedJobTypes.length === 0 ||
                  !owner
                }
              >
                Create {totalJobs > 0 ? totalJobs : ""} Job
                {totalJobs !== 1 ? "s" : ""}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
