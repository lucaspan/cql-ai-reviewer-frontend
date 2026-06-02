import { useState } from "react";
import type { GithubReviewJob } from "../types/job.types";
import { publishJob } from "../api/jobApi";
import "./Modal.css";
import "./JobDetailModal.css";

interface JobDetailModalProps {
  job: Partial<GithubReviewJob> | null;
  loading: boolean;
  onClose: () => void;
}

function Field({
  label,
  value,
  mono = false,
  full = false,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
  full?: boolean;
}) {
  const isEmpty = value == null || value === "";
  return (
    <div className={`job-detail-field${full ? " job-detail-field--full" : ""}`}>
      <div className="job-detail-field__label">{label}</div>
      <div
        className={[
          "job-detail-field__value",
          mono ? "job-detail-field__value--mono" : "",
          isEmpty ? "job-detail-field__value--empty" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {isEmpty ? "none" : value}
      </div>
    </div>
  );
}

export default function JobDetailModal({
  job,
  loading,
  onClose,
}: JobDetailModalProps) {
  const [republishing, setRepublishing] = useState(false);
  const [republishResult, setRepublishResult] = useState<{
    success: boolean;
    link?: string;
    error?: string;
  } | null>(null);

  const handleRepublish = async () => {
    if (!job?.id) return;
    setRepublishing(true);
    setRepublishResult(null);
    try {
      const result = await publishJob(job.id);
      setRepublishResult({
        success: result.published,
        link: result.link,
        error: result.error,
      });
    } catch (e: unknown) {
      setRepublishResult({
        success: false,
        error: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setRepublishing(false);
    }
  };

  const resultsJson =
    job?.results != null ? JSON.stringify(job.results, null, 2) : null;

  const payloadJson =
    job?.requestPayload != null
      ? JSON.stringify(job.requestPayload, null, 2)
      : null;

  const handleCopyResults = () => {
    if (resultsJson) navigator.clipboard.writeText(resultsJson);
  };

  const jobTypeVersionDisplay =
    job?.reviewJobType && job?.reviewJobTypeVersion != null
      ? `${job.reviewJobType} v${job.reviewJobTypeVersion}`
      : (job?.reviewJobType ?? null);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <div>
            <h2 className="modal__title">Job Details</h2>
            {job?.id && (
              <p className="modal__subtitle">
                <code>{job.id}</code>
              </p>
            )}
          </div>
          <button className="modal__close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal__body">
          {loading && <div className="modal-state">Loading job…</div>}

          {!loading && job && (
            <>
              <div className="job-detail-section">
                <p className="job-detail-section__title">Identity</p>
                <div className="job-detail-grid">
                  <Field label="Job ID" value={job.id} mono full />
                  <Field label="Dedup Key" value={job.dedupKey} mono full />
                </div>
              </div>

              <div className="job-detail-section">
                <p className="job-detail-section__title">Repository</p>
                <div className="job-detail-grid">
                  <Field label="Owner" value={job.githubOwner} />
                  <Field label="Repository" value={job.githubRepo} />
                  <Field label="Branch" value={job.githubBranch} mono />
                  <Field label="Commit" value={job.githubCommit} mono />
                  <Field label="Status" value={job.status} />
                  <Field
                    label="Job Type / Version"
                    value={jobTypeVersionDisplay}
                    mono
                  />
                  {job.error && <Field label="Error" value={job.error} full />}
                </div>
              </div>

              {(job.requestPayload as any)?.dependentRepos?.length > 0 && (
                <div className="job-detail-section">
                  <p className="job-detail-section__title">Dependent Repos</p>
                  <div className="job-detail-deps">
                    {((job.requestPayload as any).dependentRepos as any[]).map(
                      (dep: any, i: number) => (
                        <div key={i} className="job-detail-dep">
                          <span className="job-detail-dep__repo">
                            {dep.githubOwner}/{dep.githubRepo}@
                            {dep.githubBranch}
                          </span>
                          {dep.dependencyContext && (
                            <span className="job-detail-dep__ctx">
                              {dep.dependencyContext}
                            </span>
                          )}
                        </div>
                      ),
                    )}
                  </div>
                </div>
              )}

              {job.publishedLink && (
                <div className="job-detail-section">
                  <p className="job-detail-section__title">Published Link</p>
                  <div className="job-detail-published">
                    <a
                      href={job.publishedLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="job-detail-link"
                    >
                      {job.publishedLink}
                    </a>
                  </div>
                </div>
              )}

              {job.status === "COMPLETED" && (
                <div className="job-detail-section">
                  <div className="results-toolbar">
                    <span className="results-toolbar__label">Confluence</span>
                    <button
                      className="btn btn--secondary btn--sm"
                      onClick={handleRepublish}
                      disabled={republishing}
                    >
                      {republishing ? "Publishing…" : "Republish to Confluence"}
                    </button>
                  </div>
                  {republishResult && (
                    <div
                      className={`results-toolbar__status ${republishResult.success ? "results-toolbar__status--ok" : "results-toolbar__status--err"}`}
                    >
                      {republishResult.success ? (
                        <>
                          Published.{" "}
                          {republishResult.link && (
                            <a
                              href={republishResult.link}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              View page
                            </a>
                          )}
                        </>
                      ) : (
                        `Failed: ${republishResult.error ?? "unknown error"}`
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="job-detail-section">
                <p className="job-detail-section__title">Timestamps</p>
                <div className="job-detail-grid">
                  <Field
                    label="Created"
                    value={
                      job.createdAt
                        ? new Date(job.createdAt).toLocaleString()
                        : null
                    }
                  />
                  <Field
                    label="Updated"
                    value={
                      job.updatedAt
                        ? new Date(job.updatedAt).toLocaleString()
                        : null
                    }
                  />
                </div>
              </div>

              <div className="job-detail-section">
                <div className="results-toolbar">
                  <span className="results-toolbar__label">Payload</span>
                  {payloadJson && (
                    <button
                      className="btn btn--secondary btn--sm"
                      onClick={() => navigator.clipboard.writeText(payloadJson)}
                    >
                      Copy JSON
                    </button>
                  )}
                </div>
                {payloadJson ? (
                  <pre className="results-json">{payloadJson}</pre>
                ) : (
                  <div className="results-empty">No payload</div>
                )}
              </div>

              <div className="job-detail-section">
                <div className="results-toolbar">
                  <span className="results-toolbar__label">Results</span>
                  {resultsJson && (
                    <button
                      className="btn btn--secondary btn--sm"
                      onClick={handleCopyResults}
                    >
                      Copy JSON
                    </button>
                  )}
                </div>
                {resultsJson ? (
                  <pre className="results-json">{resultsJson}</pre>
                ) : (
                  <div className="results-empty">No results yet</div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
