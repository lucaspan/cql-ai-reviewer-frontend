import { useState, useEffect } from "react";
import {
  getRepoConfigs,
  createRepoConfig,
  updateRepoConfig,
  deleteRepoConfig,
  getJobTypes,
  ingestFromSource,
} from "../api/jobApi";
import type { IngestResult } from "../api/jobApi";
import type { RepoConfig, DependentRepoConfig, ReviewJobType } from "../types/job.types";
import "./RepoConfigPage.css";

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

  useEffect(() => {
    load();
    getJobTypes().then(setJobTypes).catch(() => {});
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

  const handleIngest = async (manualRepos?: { githubOwner: string; githubRepo: string; githubBranch: string }[]) => {
    setIngesting(true);
    setIngestResult(null);
    try {
      let repos: { githubOwner: string; githubRepo: string; githubBranch: string }[];
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
          return { githubOwner: ownerRepo.slice(0, slashIdx), githubRepo: ownerRepo.slice(slashIdx + 1), githubBranch: branch || "master" };
        }
        return { githubOwner: "BMO-Prod", githubRepo: ownerRepo, githubBranch: branch || "master" };
      });
  };

  if (loading) {
    return <div className="rc-state">Loading...</div>;
  }

  return (
    <div className="rc-content">
      <div className="rc-toolbar">
        <span className="rc-count">{configs.length} repo config{configs.length !== 1 ? "s" : ""}</span>
        <div className="rc-toolbar-actions">
          <button
            className="btn btn--secondary btn--sm"
            onClick={() => setShowIngestForm((v) => !v)}
            disabled={ingesting}
          >
            {ingesting ? "Running..." : "Run Ingestion"}
          </button>
          <button className="btn btn--primary btn--sm" onClick={() => setCreating(true)}>
            + Add Config
          </button>
        </div>
      </div>

      {showIngestForm && !ingesting && (
        <div className="rc-ingest-form">
          <p className="rc-ingest-form-hint">
            Run all enabled configs, or enter repos manually (one per line: <code>owner/repo branch</code> or <code>repo branch</code>)
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
              onClick={() => handleIngest(ingestText.trim() ? parseIngestText(ingestText) : undefined)}
            >
              {ingestText.trim() ? `Ingest ${parseIngestText(ingestText).length} repo(s)` : `Ingest ${configs.filter((c) => c.enabled).length} enabled config(s)`}
            </button>
            <button className="btn btn--secondary btn--sm" onClick={() => setShowIngestForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {ingestResult && (
        <div className="rc-ingest-result">
          <div className="rc-ingest-summary">
            <span className="rc-ingest-created">{ingestResult.created} created</span>
            <span className="rc-ingest-skipped">{ingestResult.skipped} skipped</span>
            <button className="btn btn--secondary btn--sm" onClick={() => setIngestResult(null)}>Dismiss</button>
          </div>
          {ingestResult.jobs.length > 0 && (
            <div className="rc-ingest-list">
              {ingestResult.jobs.map((j) => (
                <div key={j.jobId} className="rc-ingest-item rc-ingest-item--ok">
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
          onCancel={() => { setEditing(null); setCreating(false); }}
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
              <tr><td colSpan={8} className="rc-empty">No repo configs</td></tr>
            )}
            {configs.map((cfg) => (
              <tr key={cfg.id}>
                <td>{cfg.githubOwner}</td>
                <td className="rc-mono">{cfg.githubRepo}</td>
                <td>{cfg.githubBranch ?? <span className="rc-all">all</span>}</td>
                <td>
                  <div className="rc-pills">
                    {cfg.jobTypes.map((jt) => (
                      <span key={jt} className="rc-pill">{jt}</span>
                    ))}
                  </div>
                </td>
                <td>
                  {cfg.dependentRepos && cfg.dependentRepos.length > 0
                    ? cfg.dependentRepos.map((d) => (
                        <div key={`${d.githubRepo}-${d.githubBranch}`} className="rc-dep">
                          {d.githubRepo}:{d.githubBranch}
                        </div>
                      ))
                    : "—"}
                </td>
                <td>{cfg.confluenceEmails?.length ?? 0}</td>
                <td>
                  <span className={`rc-status ${cfg.enabled ? "rc-status--on" : "rc-status--off"}`}>
                    {cfg.enabled ? "On" : "Off"}
                  </span>
                </td>
                <td>
                  <div className="rc-actions">
                    <button className="btn btn--secondary btn--sm" onClick={() => setEditing(cfg)}>Edit</button>
                    <button className="btn btn--danger btn--sm" onClick={() => handleDelete(cfg.id)}>Del</button>
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
  const [deps, setDeps] = useState<DependentRepoConfig[]>(config?.dependentRepos ?? []);
  const [submitting, setSubmitting] = useState(false);

  const toggleJobType = (id: string) => {
    setForm((f) => ({
      ...f,
      jobTypes: f.jobTypes.includes(id)
        ? f.jobTypes.filter((t) => t !== id)
        : [...f.jobTypes, id],
    }));
  };

  const addDep = () => {
    setDeps((prev) => [...prev, { githubOwner: "BMO-Prod", githubRepo: "", githubBranch: "master", dependencyContext: "" }]);
  };

  const updateDep = (i: number, field: keyof DependentRepoConfig, value: string) => {
    setDeps((prev) => prev.map((d, idx) => (idx === i ? { ...d, [field]: value } : d)));
  };

  const removeDep = (i: number) => {
    setDeps((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const emails = form.confluenceEmails
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      await onSave({
        githubOwner: form.githubOwner,
        githubRepo: form.githubRepo,
        githubBranch: form.githubBranch || null,
        jobTypes: form.jobTypes,
        dependentRepos: deps.filter((d) => d.githubRepo),
        confluenceEmails: emails.length > 0 ? emails : null,
        enabled: form.enabled,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="rc-form" onSubmit={handleSubmit}>
      <div className="rc-form-grid">
        <div className="form-field">
          <label className="form-label">Owner</label>
          <input className="form-input" value={form.githubOwner} onChange={(e) => setForm((f) => ({ ...f, githubOwner: e.target.value }))} required />
        </div>
        <div className="form-field">
          <label className="form-label">Repo</label>
          <input className="form-input" value={form.githubRepo} onChange={(e) => setForm((f) => ({ ...f, githubRepo: e.target.value }))} required />
        </div>
        <div className="form-field">
          <label className="form-label">Branch <span className="form-optional">(blank = all)</span></label>
          <input className="form-input" value={form.githubBranch} onChange={(e) => setForm((f) => ({ ...f, githubBranch: e.target.value }))} placeholder="all branches" />
        </div>
      </div>

      <div className="form-field">
        <label className="form-label">Job Types</label>
        <div className="rc-job-types">
          {jobTypes.map((jt) => (
            <label key={jt.id} className="batch-job-type-chip">
              <input type="checkbox" checked={form.jobTypes.includes(jt.id)} onChange={() => toggleJobType(jt.id)} />
              <span>{jt.id}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="form-field">
        <div className="create-job-section__header">
          <label className="form-label">Dependent Repos</label>
          <button type="button" className="btn btn--secondary btn--sm" onClick={addDep}>+ Add</button>
        </div>
        {deps.map((dep, i) => (
          <div key={i} className="rc-dep-row">
            <input className="form-input" placeholder="Owner" value={dep.githubOwner} onChange={(e) => updateDep(i, "githubOwner", e.target.value)} />
            <input className="form-input" placeholder="Repo" value={dep.githubRepo} onChange={(e) => updateDep(i, "githubRepo", e.target.value)} />
            <input className="form-input" placeholder="Branch" value={dep.githubBranch} onChange={(e) => updateDep(i, "githubBranch", e.target.value)} />
            <input className="form-input" placeholder="Context (e.g. shared auth lib)" value={dep.dependencyContext} onChange={(e) => updateDep(i, "dependencyContext", e.target.value)} />
            <button type="button" className="btn btn--danger btn--sm" onClick={() => removeDep(i)}>✕</button>
          </div>
        ))}
      </div>

      <div className="form-field">
        <label className="form-label">Confluence Emails <span className="form-optional">(comma-separated)</span></label>
        <input className="form-input" value={form.confluenceEmails} onChange={(e) => setForm((f) => ({ ...f, confluenceEmails: e.target.value }))} placeholder="user@bank.com, team@bank.com" />
      </div>

      <label className="rc-enabled-toggle">
        <input type="checkbox" checked={form.enabled} onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))} />
        <span>Enabled</span>
      </label>

      <div className="rc-form-footer">
        <button type="button" className="btn btn--secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn--primary" disabled={submitting || !form.githubRepo || form.jobTypes.length === 0}>
          {submitting ? "Saving..." : config ? "Update" : "Create"}
        </button>
      </div>
    </form>
  );
}
