import { useState, useEffect } from "react";
import {
  getRepoConfigs,
  createRepoConfig,
  updateRepoConfig,
  deleteRepoConfig,
  getJobTypes,
  ingestFromSource,
  getSourceRepos,
} from "../api/jobApi";
import type { IngestResult, SourceRepo } from "../api/jobApi";
import type {
  RepoConfig,
  DependentRepoConfig,
  ReviewJobType,
} from "../types/job.types";
import "./RepoConfigPage.css";
import "../components/Modal.css";

const previewTh: React.CSSProperties = {
  textAlign: "left",
  padding: "4px 8px",
  borderBottom: "1px solid #ddd",
};
const previewTd: React.CSSProperties = { padding: "4px 8px" };

export default function RepoConfigPage() {
  const [configs, setConfigs] = useState<RepoConfig[]>([]);
  const [jobTypes, setJobTypes] = useState<ReviewJobType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<RepoConfig | null>(null);
  const [creating, setCreating] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [ingestResult, setIngestResult] = useState<IngestResult | null>(null);
  const [showIngestForm, setShowIngestForm] = useState(false);
  const [ingestText, setIngestText] = useState("");

  const [sourceIngestLoading, setSourceIngestLoading] = useState(false);

  // Batch-create repo configs.
  const [showBatchForm, setShowBatchForm] = useState(false);
  const [batchText, setBatchText] = useState("");
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchResult, setBatchResult] = useState<{
    created: number;
    failed: number;
    errors: string[];
  } | null>(null);

  // Ingest-from-source preview → confirm flow.
  const [sourcePreview, setSourcePreview] = useState<SourceRepo[] | null>(null);
  const [sourcePreviewLoading, setSourcePreviewLoading] = useState(false);

  useEffect(() => {
    load();
    getJobTypes()
      .then(setJobTypes)
      .catch(() => {});
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      setConfigs(await getRepoConfigs());
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteRepoConfig(id);
    setConfigs((prev) => prev.filter((c) => c.id !== id));
  };

  const handleIngest = async (
    manualRepos?: {
      githubOwner: string;
      githubRepo: string;
      githubBranch: string;
    }[],
  ) => {
    setIngesting(true);
    setIngestResult(null);
    try {
      let repos: {
        githubOwner: string;
        githubRepo: string;
        githubBranch: string;
      }[];
      if (manualRepos && manualRepos.length > 0) {
        repos = manualRepos;
      } else {
        const enabledConfigs = configs.filter((c) => c.enabled);
        repos = enabledConfigs.map((c) => ({
          githubOwner: c.githubOwner,
          githubRepo: c.githubRepo,
          githubBranch: c.githubBranch ?? "master",
        }));
      }
      const result = await ingestFromSource(repos);
      setIngestResult(result);
    } catch {
      // silent
    } finally {
      setIngesting(false);
      setShowIngestForm(false);
    }
  };

  /** Step 1: preview the repos the source DB query would return (no jobs created). */
  const handlePreviewSource = async () => {
    setSourcePreviewLoading(true);
    setSourcePreview(null);
    setIngestResult(null);
    try {
      setSourcePreview(await getSourceRepos());
    } catch {
      // silent
    } finally {
      setSourcePreviewLoading(false);
    }
  };

  /** Step 2: confirm — ingest the previewed repos. */
  const handleConfirmIngestSource = async () => {
    if (!sourcePreview) return;
    setSourceIngestLoading(true);
    setIngestResult(null);
    try {
      // Pass the previewed list back as the override so we ingest exactly what was shown.
      setIngestResult(await ingestFromSource(sourcePreview));
      setSourcePreview(null);
    } catch {
      // silent
    } finally {
      setSourceIngestLoading(false);
    }
  };

  const parseIngestText = (text: string) => {
    return text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(/\s+/);
        const [ownerRepo, branch] = parts;
        const slashIdx = ownerRepo.indexOf("/");
        if (slashIdx > 0) {
          return {
            githubOwner: ownerRepo.slice(0, slashIdx),
            githubRepo: ownerRepo.slice(slashIdx + 1),
            githubBranch: branch || "master",
          };
        }
        return {
          githubOwner: "BMO-Prod",
          githubRepo: ownerRepo,
          githubBranch: branch || "master",
        };
      });
  };

  // Treat "-" or "null" (case-insensitive) as an explicit null for a column.
  const isNullToken = (s: string) => s === "-" || s.toLowerCase() === "null";

  // Parse a batch line: owner repo branch jobTypes emails
  //   branch:   "-"/"null" → null (all branches)
  //   jobTypes: "-"/"null" → null (inherit defaults); otherwise comma-separated list
  //   emails:   "-"/"null" → null; otherwise comma-separated list
  const parseBatchLine = (
    line: string,
  ): { ok: true; data: Partial<RepoConfig> } | { ok: false; error: string } => {
    const parts = line.split(/\s+/);
    if (parts.length < 2) {
      return { ok: false, error: `"${line}" — need at least owner and repo` };
    }
    const [owner, repo, branch, jobTypesRaw, emailsRaw] = parts;

    const githubBranch = !branch || isNullToken(branch) ? null : branch;

    const jobTypes =
      !jobTypesRaw || isNullToken(jobTypesRaw)
        ? null
        : jobTypesRaw
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);

    const confluenceEmails =
      !emailsRaw || isNullToken(emailsRaw)
        ? null
        : [
            ...new Set(
              emailsRaw
                .split(",")
                .map((s) => s.trim().toLowerCase())
                .filter(Boolean),
            ),
          ];

    return {
      ok: true,
      data: {
        githubOwner: owner,
        githubRepo: repo,
        githubBranch,
        jobTypes,
        confluenceEmails,
        enabled: true,
      },
    };
  };

  const handleBatchCreate = async () => {
    const lines = batchText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;

    setBatchRunning(true);
    setBatchResult(null);
    let created = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const line of lines) {
      const parsed = parseBatchLine(line);
      if (!parsed.ok) {
        failed++;
        errors.push(parsed.error);
        continue;
      }
      try {
        await createRepoConfig(parsed.data);
        created++;
      } catch (err) {
        failed++;
        errors.push(`"${line}" — ${(err as Error).message}`);
      }
    }

    setBatchRunning(false);
    setBatchResult({ created, failed, errors });
    setBatchText("");
    load();
  };

  if (loading) {
    return <div className="rc-state">Loading...</div>;
  }

  return (
    <div className="rc-content">
      <div className="rc-toolbar">
        <span className="rc-count">
          {configs.length} repo config{configs.length !== 1 ? "s" : ""}
        </span>
        <div className="rc-toolbar-actions">
          <button
            className="btn btn--warning btn--sm"
            onClick={handlePreviewSource}
            disabled={sourcePreviewLoading || sourceIngestLoading || ingesting}
            title="Preview repos from the source DB query, then confirm to ingest"
          >
            {sourcePreviewLoading ? "Loading…" : "Ingest from Source"}
          </button>
          <button
            className="btn btn--secondary btn--sm"
            onClick={() => setShowIngestForm((v) => !v)}
            disabled={ingesting}
          >
            {ingesting ? "Running..." : "Run Ingestion"}
          </button>
          <button
            className="btn btn--secondary btn--sm"
            onClick={() => setShowBatchForm((v) => !v)}
            disabled={batchRunning}
          >
            Batch Add
          </button>
          <button
            className="btn btn--primary btn--sm"
            onClick={() => setCreating(true)}
          >
            + Add Config
          </button>
        </div>
      </div>

      {showBatchForm && (
        <div className="rc-ingest-form">
          <p className="rc-ingest-form-hint">
            One config per line:{" "}
            <code>owner repo branch jobTypes emails</code>. Use <code>-</code>{" "}
            (or <code>null</code>) for a null field. <code>branch</code> null ={" "}
            all branches; <code>jobTypes</code> null = inherit defaults;{" "}
            <code>jobTypes</code>/<code>emails</code> are comma-separated (no
            spaces).
          </p>
          <textarea
            className="batch-textarea"
            placeholder={`BMO-Prod my-repo master PII,PERFORMANCE a@bmo.com,b@bmo.com\nBMO-Prod other-repo - - -\nBMO-Prod third-repo master PII null`}
            value={batchText}
            onChange={(e) => setBatchText(e.target.value)}
            rows={5}
            spellCheck={false}
            disabled={batchRunning}
          />
          <div className="rc-ingest-form-actions">
            <button
              className="btn btn--primary btn--sm"
              onClick={handleBatchCreate}
              disabled={batchRunning || !batchText.trim()}
            >
              {batchRunning
                ? "Creating…"
                : `Create ${batchText.split("\n").map((l) => l.trim()).filter(Boolean).length} config(s)`}
            </button>
            <button
              className="btn btn--secondary btn--sm"
              onClick={() => {
                setShowBatchForm(false);
                setBatchResult(null);
              }}
              disabled={batchRunning}
            >
              Cancel
            </button>
          </div>
          {batchResult && (
            <div className="rc-ingest-result" style={{ marginTop: 12 }}>
              <div className="rc-ingest-summary">
                <span className="rc-ingest-created">
                  {batchResult.created} created
                </span>
                <span className="rc-ingest-skipped">
                  {batchResult.failed} failed
                </span>
              </div>
              {batchResult.errors.length > 0 && (
                <div className="rc-ingest-list">
                  {batchResult.errors.map((e, i) => (
                    <div key={i} className="rc-ingest-item rc-ingest-item--skip">
                      {e}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {sourcePreview !== null && (
        <div className="rc-ingest-form">
          <p className="rc-ingest-form-hint">
            {sourcePreview.length} repo(s) from the source query. Review, then
            confirm to create jobs — no jobs are created until you confirm.
          </p>
          {sourcePreview.length > 0 ? (
            <div style={{ maxHeight: 300, overflowY: "auto", fontSize: 12 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={previewTh}>Repo</th>
                    <th style={previewTh}>Branch</th>
                    <th style={previewTh}>Pod Domain</th>
                    <th style={previewTh}>SQ Event Date</th>
                  </tr>
                </thead>
                <tbody>
                  {sourcePreview.map((r, i) => (
                    <tr key={i}>
                      <td style={previewTd}>{r.githubRepo}</td>
                      <td style={previewTd}>{r.githubBranch}</td>
                      <td style={previewTd}>
                        {(r.payload as Record<string, unknown> | undefined)
                          ?.podDomain as string ?? "—"}
                      </td>
                      <td style={previewTd}>
                        {(r.payload as Record<string, unknown> | undefined)
                          ?.sqEventCreatedAt
                          ? new Date(
                              (r.payload as Record<string, string>)
                                .sqEventCreatedAt,
                            ).toLocaleDateString()
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rc-ingest-form-hint">
              No repos matched the source query with the current settings.
            </p>
          )}
          <div className="rc-ingest-form-actions">
            <button
              className="btn btn--primary btn--sm"
              onClick={handleConfirmIngestSource}
              disabled={sourceIngestLoading || sourcePreview.length === 0}
            >
              {sourceIngestLoading
                ? "Ingesting…"
                : `Confirm & Ingest ${sourcePreview.length} repo(s)`}
            </button>
            <button
              className="btn btn--secondary btn--sm"
              onClick={() => setSourcePreview(null)}
              disabled={sourceIngestLoading}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showIngestForm && !ingesting && (
        <div className="rc-ingest-form">
          <p className="rc-ingest-form-hint">
            Run all enabled configs, or enter repos manually (one per line:{" "}
            <code>owner/repo branch</code> or <code>repo branch</code>)
          </p>
          <textarea
            className="batch-textarea"
            placeholder={`BMO-Prod/my-repo master\nother-repo develop`}
            value={ingestText}
            onChange={(e) => setIngestText(e.target.value)}
            rows={4}
            spellCheck={false}
          />
          <div className="rc-ingest-form-actions">
            <button
              className="btn btn--primary btn--sm"
              onClick={() =>
                handleIngest(
                  ingestText.trim() ? parseIngestText(ingestText) : undefined,
                )
              }
            >
              {ingestText.trim()
                ? `Ingest ${parseIngestText(ingestText).length} repo(s)`
                : `Ingest ${configs.filter((c) => c.enabled).length} enabled config(s)`}
            </button>
            <button
              className="btn btn--secondary btn--sm"
              onClick={() => setShowIngestForm(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {ingestResult && (
        <div className="rc-ingest-result">
          <div className="rc-ingest-summary">
            <span className="rc-ingest-created">
              {ingestResult.created} created
            </span>
            <span className="rc-ingest-skipped">
              {ingestResult.skipped} skipped
            </span>
            <button
              className="btn btn--secondary btn--sm"
              onClick={() => setIngestResult(null)}
            >
              Dismiss
            </button>
          </div>
          {ingestResult.jobs.length > 0 && (
            <div className="rc-ingest-list">
              {ingestResult.jobs.map((j) => (
                <div
                  key={j.jobId}
                  className="rc-ingest-item rc-ingest-item--ok"
                >
                  {j.repo}/{j.branch} — {j.jobType}
                </div>
              ))}
            </div>
          )}
          {ingestResult.skippedRepos.length > 0 && (
            <div className="rc-ingest-list">
              {ingestResult.skippedRepos.map((s, i) => (
                <div key={i} className="rc-ingest-item rc-ingest-item--skip">
                  {s.repo}/{s.branch} — {s.jobType}: {s.reason}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {(creating || editing) && (
        <RepoConfigForm
          config={editing}
          jobTypes={jobTypes}
          onSave={async (data) => {
            if (editing) {
              await updateRepoConfig(editing.id, data);
            } else {
              await createRepoConfig(data);
            }
            setEditing(null);
            setCreating(false);
            load();
          }}
          onCancel={() => {
            setEditing(null);
            setCreating(false);
          }}
        />
      )}

      <div className="rc-table-wrapper">
        <table className="rc-table">
          <thead>
            <tr>
              <th>Owner</th>
              <th>Repo</th>
              <th>Branch</th>
              <th>Job Types</th>
              <th>Dependent Repos</th>
              <th>Emails</th>
              <th>Enabled</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {configs.length === 0 && (
              <tr>
                <td colSpan={8} className="rc-empty">
                  No repo configs
                </td>
              </tr>
            )}
            {configs.map((cfg) => (
              <tr key={cfg.id}>
                <td>{cfg.githubOwner}</td>
                <td className="rc-mono">{cfg.githubRepo}</td>
                <td>
                  {cfg.githubBranch ?? <span className="rc-all">all</span>}
                </td>
                <td>
                  {cfg.jobTypes === null ? (
                    <span className="rc-all">default</span>
                  ) : cfg.jobTypes.length === 0 ? (
                    <span className="rc-all">none</span>
                  ) : (
                    <div className="rc-pills">
                      {cfg.jobTypes.map((jt) => (
                        <span key={jt} className="rc-pill">
                          {jt}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td>
                  {cfg.dependentRepos && cfg.dependentRepos.length > 0
                    ? cfg.dependentRepos.map((d) => (
                        <div
                          key={`${d.githubRepo}-${d.githubBranch}`}
                          className="rc-dep"
                        >
                          {d.githubRepo}:{d.githubBranch}
                        </div>
                      ))
                    : "—"}
                </td>
                <td>{cfg.confluenceEmails?.length ?? 0}</td>
                <td>
                  <span
                    className={`rc-status ${cfg.enabled ? "rc-status--on" : "rc-status--off"}`}
                  >
                    {cfg.enabled ? "On" : "Off"}
                  </span>
                </td>
                <td>
                  <div className="rc-actions">
                    <button
                      className="btn btn--secondary btn--sm"
                      onClick={() => setEditing(cfg)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn--danger btn--sm"
                      onClick={() => handleDelete(cfg.id)}
                    >
                      Del
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RepoConfigForm({
  config,
  jobTypes,
  onSave,
  onCancel,
}: {
  config: RepoConfig | null;
  jobTypes: ReviewJobType[];
  onSave: (data: Partial<RepoConfig>) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    githubOwner: config?.githubOwner ?? "BMO-Prod",
    githubRepo: config?.githubRepo ?? "",
    githubBranch: config?.githubBranch ?? "",
    jobTypes: config?.jobTypes ?? [],
    confluenceEmails: config?.confluenceEmails?.join(", ") ?? "",
    enabled: config?.enabled ?? true,
  });
  // jobTypes is tri-state:
  //   null  → inherit the default job types from JOB_CREATION_SETTING (inherit = true)
  //   []    → custom + empty → suppress job creation for this repo
  //   [...] → custom explicit list
  // A brand-new config defaults to "inherit".
  const [inheritJobTypes, setInheritJobTypes] = useState(
    config ? config.jobTypes === null : true,
  );
  const [deps, setDeps] = useState<DependentRepoConfig[]>(
    config?.dependentRepos ?? [],
  );
  const [submitting, setSubmitting] = useState(false);

  // Close on Escape (modal-escape / escape-routes).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [submitting, onCancel]);

  const toggleJobType = (id: string) => {
    setForm((f) => ({
      ...f,
      jobTypes: f.jobTypes.includes(id)
        ? f.jobTypes.filter((t) => t !== id)
        : [...f.jobTypes, id],
    }));
  };

  const addDep = () => {
    setDeps((prev) => [
      ...prev,
      {
        githubOwner: "BMO-Prod",
        githubRepo: "",
        githubBranch: "master",
        dependencyContext: "",
      },
    ]);
  };

  const updateDep = (
    i: number,
    field: keyof DependentRepoConfig,
    value: string,
  ) => {
    setDeps((prev) =>
      prev.map((d, idx) => (idx === i ? { ...d, [field]: value } : d)),
    );
  };

  const removeDep = (i: number) => {
    setDeps((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const emails = [
        ...new Set(
          form.confluenceEmails
            .split(",")
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean),
        ),
      ];
      await onSave({
        githubOwner: form.githubOwner,
        githubRepo: form.githubRepo,
        githubBranch: form.githubBranch || null,
        jobTypes: inheritJobTypes ? null : form.jobTypes,
        dependentRepos: deps.filter((d) => d.githubRepo),
        confluenceEmails: emails.length > 0 ? emails : null,
        enabled: form.enabled,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      onClick={() => {
        if (!submitting) onCancel();
      }}
    >
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <div>
            <h2 className="modal__title">
              {config ? "Edit Repo Config" : "Add Repo Config"}
            </h2>
            <p className="modal__subtitle">
              {config
                ? `${config.githubOwner}/${config.githubRepo}`
                : "Configure job types, dependent repos, and viewers for a repository"}
            </p>
          </div>
          <button
            className="modal__close"
            onClick={onCancel}
            disabled={submitting}
            type="button"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form className="modal__body rc-form" onSubmit={handleSubmit}>
          <div className="rc-form-grid">
            <div className="form-field">
              <label className="form-label">Owner</label>
          <input
            className="form-input"
            value={form.githubOwner}
            onChange={(e) =>
              setForm((f) => ({ ...f, githubOwner: e.target.value }))
            }
            required
          />
        </div>
        <div className="form-field">
          <label className="form-label">Repo</label>
          <input
            className="form-input"
            value={form.githubRepo}
            onChange={(e) =>
              setForm((f) => ({ ...f, githubRepo: e.target.value }))
            }
            required
          />
        </div>
        <div className="form-field">
          <label className="form-label">
            Branch <span className="form-optional">(blank = all)</span>
          </label>
          <input
            className="form-input"
            value={form.githubBranch}
            onChange={(e) =>
              setForm((f) => ({ ...f, githubBranch: e.target.value }))
            }
            placeholder="all branches"
          />
        </div>
      </div>

      <div className="form-field">
        <label className="form-label">Job Types</label>
        <label className="rc-enabled-toggle">
          <input
            type="checkbox"
            checked={inheritJobTypes}
            onChange={(e) => setInheritJobTypes(e.target.checked)}
          />
          <span>Inherit default job types</span>
        </label>
        {inheritJobTypes ? (
          <p className="form-optional" style={{ marginTop: 8 }}>
            Uses the default job types from Job Creation settings.
          </p>
        ) : (
          <>
            <div className="rc-job-types" style={{ marginTop: 8 }}>
              {jobTypes.map((jt) => (
                <label key={jt.id} className="batch-job-type-chip">
                  <input
                    type="checkbox"
                    checked={form.jobTypes.includes(jt.id)}
                    onChange={() => toggleJobType(jt.id)}
                  />
                  <span>{jt.id}</span>
                </label>
              ))}
            </div>
            {form.jobTypes.length === 0 && (
              <p className="form-optional" style={{ marginTop: 8 }}>
                No job types selected — no jobs will be created for this repo.
              </p>
            )}
          </>
        )}
      </div>

      <div className="form-field">
        <div className="create-job-section__header">
          <label className="form-label">Dependent Repos</label>
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={addDep}
          >
            + Add
          </button>
        </div>
        {deps.map((dep, i) => (
          <div key={i} className="rc-dep-row">
            <input
              className="form-input"
              placeholder="Owner"
              value={dep.githubOwner}
              onChange={(e) => updateDep(i, "githubOwner", e.target.value)}
            />
            <input
              className="form-input"
              placeholder="Repo"
              value={dep.githubRepo}
              onChange={(e) => updateDep(i, "githubRepo", e.target.value)}
            />
            <input
              className="form-input"
              placeholder="Branch"
              value={dep.githubBranch}
              onChange={(e) => updateDep(i, "githubBranch", e.target.value)}
            />
            <input
              className="form-input"
              placeholder="Context (e.g. shared auth lib)"
              value={dep.dependencyContext}
              onChange={(e) =>
                updateDep(i, "dependencyContext", e.target.value)
              }
            />
            <button
              type="button"
              className="btn btn--danger btn--sm"
              onClick={() => removeDep(i)}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="form-field">
        <label className="form-label">
          Confluence Emails{" "}
          <span className="form-optional">(comma-separated)</span>
        </label>
        <input
          className="form-input"
          value={form.confluenceEmails}
          onChange={(e) =>
            setForm((f) => ({ ...f, confluenceEmails: e.target.value }))
          }
          placeholder="user@bank.com, team@bank.com"
        />
      </div>

      <label className="rc-enabled-toggle">
        <input
          type="checkbox"
          checked={form.enabled}
          onChange={(e) =>
            setForm((f) => ({ ...f, enabled: e.target.checked }))
          }
        />
        <span>Enabled</span>
      </label>

          <div className="modal__footer">
            <button
              type="button"
              className="btn btn--secondary"
              onClick={onCancel}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={submitting || !form.githubRepo}
            >
              {submitting ? "Saving..." : config ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
