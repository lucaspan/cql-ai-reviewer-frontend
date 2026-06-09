import { useState, useEffect } from "react";
import {
  getSetting,
  updateSetting,
  getJobTypes,
  getSourceRepos,
} from "../api/jobApi";
import type { ReviewJobType } from "../types/job.types";
import "./SettingsPage.css";

interface JobSchedulerSetting {
  enabled: boolean;
  crawlers: {
    pendingJobCrawlerEnabled: boolean;
    sqsPollingEnabled: boolean;
  };
  sqsFilter: {
    branchPatterns: string[];
    repoPatterns: string[];
  };
}

interface JobCreationSetting {
  defaultJobTypes: string[];
  dedupDays: number;
  defaultConfluenceEmails: string[];
  sourceQueryLimit: number;
  sourceQueryRecentDays: number;
  sourceQueryPodDomains: string[];
}

interface ModelRoutingSetting {
  enabled: boolean;
  discoveryModel: string;
  reviewModel: string;
  summaryModel: string;
  diffModel: string;
  inventoryModel: string;
}

const BEDROCK_MODELS = [
  { id: "us.anthropic.claude-opus-4-5-20251101-v1:0", label: "Opus 4.5" },
  { id: "us.anthropic.claude-sonnet-4-5-20250929-v1:0", label: "Sonnet 4.5" },
  { id: "us.anthropic.claude-sonnet-4-6", label: "Sonnet 4.6" },
  { id: "us.anthropic.claude-haiku-4-5-20251001-v1:0", label: "Haiku 4.5" },
];

export default function SettingsPage() {
  const [setting, setSetting] = useState<JobSchedulerSetting | null>(null);
  const [creationSetting, setCreationSetting] =
    useState<JobCreationSetting | null>(null);
  const [routingSetting, setRoutingSetting] =
    useState<ModelRoutingSetting | null>(null);
  const [jobTypes, setJobTypes] = useState<ReviewJobType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [sourceRepos, setSourceRepos] = useState<
    | {
        githubOwner: string;
        githubRepo: string;
        githubBranch: string;
        payload?: Record<string, unknown>;
      }[]
    | null
  >(null);
  const [sourceReposLoading, setSourceReposLoading] = useState(false);
  const [sourceReposError, setSourceReposError] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
    getJobTypes()
      .then(setJobTypes)
      .catch(() => {});
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const [schedulerRes, creationRes, routingRes] = await Promise.all([
        getSetting("JOB_SCHEDULER_SETTING"),
        getSetting("JOB_CREATION_SETTING"),
        getSetting("MODEL_ROUTING_SETTING"),
      ]);
      setSetting(schedulerRes.value as unknown as JobSchedulerSetting);
      setCreationSetting(creationRes.value as unknown as JobCreationSetting);
      setRoutingSetting(routingRes.value as unknown as ModelRoutingSetting);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const saveSchedulerSetting = async (updated: JobSchedulerSetting) => {
    setSetting(updated);
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await updateSetting(
        "JOB_SCHEDULER_SETTING",
        updated as unknown as Record<string, unknown>,
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError((err as Error).message);
      loadSettings();
    } finally {
      setSaving(false);
    }
  };

  const saveCreationSetting = async (updated: JobCreationSetting) => {
    setCreationSetting(updated);
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await updateSetting(
        "JOB_CREATION_SETTING",
        updated as unknown as Record<string, unknown>,
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError((err as Error).message);
      loadSettings();
    } finally {
      setSaving(false);
    }
  };

  const saveRoutingSetting = async (updated: ModelRoutingSetting) => {
    setRoutingSetting(updated);
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await updateSetting(
        "MODEL_ROUTING_SETTING",
        updated as unknown as Record<string, unknown>,
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError((err as Error).message);
      loadSettings();
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (path: "enabled" | "pendingJobCrawlerEnabled" | "sqsPollingEnabled") => {
    if (!setting) return;
    const updated = { ...setting, crawlers: { ...setting.crawlers }, sqsFilter: { ...setting.sqsFilter } };
    if (path === "enabled") {
      updated.enabled = !updated.enabled;
    } else {
      updated.crawlers[path] = !updated.crawlers[path];
    }
    saveSchedulerSetting(updated);
  };

  const [branchPatternInput, setBranchPatternInput] = useState("");
  const [repoPatternInput, setRepoPatternInput] = useState("");

  const addBranchPattern = () => {
    if (!setting || !branchPatternInput.trim()) return;
    const pattern = branchPatternInput.trim();
    if (setting.sqsFilter.branchPatterns.includes(pattern)) return;
    saveSchedulerSetting({
      ...setting,
      sqsFilter: { ...setting.sqsFilter, branchPatterns: [...setting.sqsFilter.branchPatterns, pattern] }
    });
    setBranchPatternInput("");
  };

  const removeBranchPattern = (index: number) => {
    if (!setting) return;
    saveSchedulerSetting({
      ...setting,
      sqsFilter: { ...setting.sqsFilter, branchPatterns: setting.sqsFilter.branchPatterns.filter((_, i) => i !== index) }
    });
  };

  const addRepoPattern = () => {
    if (!setting || !repoPatternInput.trim()) return;
    const pattern = repoPatternInput.trim();
    if (setting.sqsFilter.repoPatterns.includes(pattern)) return;
    saveSchedulerSetting({
      ...setting,
      sqsFilter: { ...setting.sqsFilter, repoPatterns: [...setting.sqsFilter.repoPatterns, pattern] }
    });
    setRepoPatternInput("");
  };

  const removeRepoPattern = (index: number) => {
    if (!setting) return;
    saveSchedulerSetting({
      ...setting,
      sqsFilter: { ...setting.sqsFilter, repoPatterns: setting.sqsFilter.repoPatterns.filter((_, i) => i !== index) }
    });
  };

  const toggleDefaultJobType = (id: string) => {
    if (!creationSetting) return;
    const current = creationSetting.defaultJobTypes;
    const next = current.includes(id)
      ? current.filter((t) => t !== id)
      : [...current, id];
    saveCreationSetting({ ...creationSetting, defaultJobTypes: next });
  };

  const [emailInput, setEmailInput] = useState("");

  const addEmail = () => {
    if (!creationSetting || !emailInput.trim()) return;
    const email = emailInput.trim();
    if (creationSetting.defaultConfluenceEmails.includes(email)) return;
    saveCreationSetting({
      ...creationSetting,
      defaultConfluenceEmails: [
        ...creationSetting.defaultConfluenceEmails,
        email,
      ],
    });
    setEmailInput("");
  };

  const removeEmail = (index: number) => {
    if (!creationSetting) return;
    saveCreationSetting({
      ...creationSetting,
      defaultConfluenceEmails: creationSetting.defaultConfluenceEmails.filter(
        (_, i) => i !== index,
      ),
    });
  };

  const [dedupInput, setDedupInput] = useState("");
  const [podDomainInput, setPodDomainInput] = useState("");
  const [sourceLimitInput, setSourceLimitInput] = useState("");
  const [sourceRecentDaysInput, setSourceRecentDaysInput] = useState("");

  const addPodDomain = () => {
    if (!creationSetting || !podDomainInput.trim()) return;
    const domain = podDomainInput.trim();
    if (creationSetting.sourceQueryPodDomains.includes(domain)) return;
    saveCreationSetting({
      ...creationSetting,
      sourceQueryPodDomains: [...creationSetting.sourceQueryPodDomains, domain],
    });
    setPodDomainInput("");
  };

  const removePodDomain = (index: number) => {
    if (!creationSetting) return;
    saveCreationSetting({
      ...creationSetting,
      sourceQueryPodDomains: creationSetting.sourceQueryPodDomains.filter(
        (_, i) => i !== index,
      ),
    });
  };

  const handlePreviewSourceRepos = async () => {
    setSourceReposLoading(true);
    setSourceReposError(null);
    setSourceRepos(null);
    try {
      const repos = await getSourceRepos();
      setSourceRepos(repos);
    } catch (err) {
      setSourceReposError((err as Error).message);
    } finally {
      setSourceReposLoading(false);
    }
  };

  if (loading) {
    return <div className="settings-state">Loading settings...</div>;
  }

  if (error && !setting) {
    return <div className="settings-state settings-state--error">{error}</div>;
  }

  return (
    <div className="settings-content">
      <div className="settings-card">
        <h3 className="settings-card__title">Job Scheduler</h3>
        <p className="settings-card__desc">
          Controls whether the job scheduler is active and which crawlers are
          enabled.
        </p>

        <div className="settings-toggles">
          <ToggleRow
            label="Scheduler Enabled"
            description="Master switch for the job scheduler"
            checked={setting?.enabled ?? false}
            onChange={() => handleToggle("enabled")}
            disabled={saving}
          />
          <ToggleRow
            label="Pending Job Crawler"
            description="Automatically process pending jobs"
            checked={setting?.crawlers.pendingJobCrawlerEnabled ?? false}
            onChange={() => handleToggle("pendingJobCrawlerEnabled")}
            disabled={saving || !setting?.enabled}
          />
          <ToggleRow
            label="SQS Polling"
            description="Poll SQS queue for new review events (every 10 min)"
            checked={setting?.crawlers.sqsPollingEnabled ?? false}
            onChange={() => handleToggle("sqsPollingEnabled")}
            disabled={saving || !setting?.enabled}
          />
        </div>

        <div className="settings-section">
          <label className="form-label">SQS Filter — Branch Patterns (regex)</label>
          <p className="settings-hint">
            Only create jobs for branches matching at least one pattern
          </p>
          <div className="settings-list">
            {setting?.sqsFilter.branchPatterns.map((pattern, i) => (
              <div key={i} className="settings-list-item">
                <code>{pattern}</code>
                <button className="btn btn--danger btn--sm" onClick={() => removeBranchPattern(i)} disabled={saving}>✕</button>
              </div>
            ))}
          </div>
          <div className="settings-add-row">
            <input
              className="form-input"
              placeholder="^(master|main|develop.*)$"
              value={branchPatternInput}
              onChange={(e) => setBranchPatternInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addBranchPattern()}
            />
            <button className="btn btn--secondary btn--sm" onClick={addBranchPattern} disabled={saving || !branchPatternInput.trim()}>
              Add
            </button>
          </div>
        </div>

        <div className="settings-section">
          <label className="form-label">SQS Filter — Repo Patterns (regex)</label>
          <p className="settings-hint">
            Only create jobs for repos matching at least one pattern
          </p>
          <div className="settings-list">
            {setting?.sqsFilter.repoPatterns.map((pattern, i) => (
              <div key={i} className="settings-list-item">
                <code>{pattern}</code>
                <button className="btn btn--danger btn--sm" onClick={() => removeRepoPattern(i)} disabled={saving}>✕</button>
              </div>
            ))}
          </div>
          <div className="settings-add-row">
            <input
              className="form-input"
              placeholder=".*"
              value={repoPatternInput}
              onChange={(e) => setRepoPatternInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addRepoPattern()}
            />
            <button className="btn btn--secondary btn--sm" onClick={addRepoPattern} disabled={saving || !repoPatternInput.trim()}>
              Add
            </button>
          </div>
        </div>
      </div>

      <div className="settings-card">
        <h3 className="settings-card__title">Job Creation</h3>
        <p className="settings-card__desc">
          Default settings for job ingestion. Per-repo overrides are in Repo
          Config.
        </p>

        <div className="settings-section">
          <label className="form-label">Default Job Types</label>
          <p className="settings-hint">
            Applied when a repo has no matching repo_config entry
          </p>
          <div className="settings-chips">
            {jobTypes.map((jt) => (
              <label key={jt.id} className="settings-chip">
                <input
                  type="checkbox"
                  checked={
                    creationSetting?.defaultJobTypes.includes(jt.id) ?? false
                  }
                  onChange={() => toggleDefaultJobType(jt.id)}
                  disabled={saving}
                />
                <span>{jt.id}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="settings-section">
          <label className="form-label">Dedup Window (days)</label>
          <p className="settings-hint">
            Skip ingestion if a job for same repo/branch/type was created within
            this many days
          </p>
          <div className="settings-add-row">
            <input
              className="form-input"
              type="number"
              min={0}
              value={
                dedupInput !== ""
                  ? dedupInput
                  : (creationSetting?.dedupDays ?? 30)
              }
              onChange={(e) => setDedupInput(e.target.value)}
              onBlur={() => {
                const val = parseInt(dedupInput);
                if (
                  creationSetting &&
                  !isNaN(val) &&
                  val >= 0 &&
                  val !== creationSetting.dedupDays
                ) {
                  saveCreationSetting({ ...creationSetting, dedupDays: val });
                }
                setDedupInput("");
              }}
              style={{ width: 100 }}
            />
          </div>
        </div>

        <div className="settings-section">
          <label className="form-label">Source Query — Limit</label>
          <p className="settings-hint">
            Max number of repos returned from the SonarQube source query
          </p>
          <div className="settings-add-row">
            <input
              className="form-input"
              type="number"
              min={1}
              value={
                sourceLimitInput || (creationSetting?.sourceQueryLimit ?? 200)
              }
              onChange={(e) => setSourceLimitInput(e.target.value)}
              onBlur={() => {
                const val = parseInt(sourceLimitInput);
                if (
                  creationSetting &&
                  val > 0 &&
                  val !== creationSetting.sourceQueryLimit
                ) {
                  saveCreationSetting({
                    ...creationSetting,
                    sourceQueryLimit: val,
                  });
                }
                setSourceLimitInput("");
              }}
              style={{ width: 100 }}
            />
          </div>
        </div>

        <div className="settings-section">
          <label className="form-label">Source Query — Recent Days</label>
          <p className="settings-hint">
            Only include repos with a SonarQube event within this many days
          </p>
          <div className="settings-add-row">
            <input
              className="form-input"
              type="number"
              min={1}
              value={
                sourceRecentDaysInput ||
                (creationSetting?.sourceQueryRecentDays ?? 7)
              }
              onChange={(e) => setSourceRecentDaysInput(e.target.value)}
              onBlur={() => {
                const val = parseInt(sourceRecentDaysInput);
                if (
                  creationSetting &&
                  val > 0 &&
                  val !== creationSetting.sourceQueryRecentDays
                ) {
                  saveCreationSetting({
                    ...creationSetting,
                    sourceQueryRecentDays: val,
                  });
                }
                setSourceRecentDaysInput("");
              }}
              style={{ width: 100 }}
            />
          </div>
        </div>

        <div className="settings-section">
          <label className="form-label">Source Query — Pod Domains</label>
          <p className="settings-hint">
            Only include repos whose pod domain matches one of these values
          </p>
          <div className="settings-list">
            {creationSetting?.sourceQueryPodDomains.map((domain, i) => (
              <div key={i} className="settings-list-item">
                <code>{domain}</code>
                <button
                  className="btn btn--danger btn--sm"
                  onClick={() => removePodDomain(i)}
                  disabled={saving}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div className="settings-add-row">
            <input
              className="form-input"
              placeholder="e.g. Contact Centre"
              value={podDomainInput}
              onChange={(e) => setPodDomainInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addPodDomain()}
            />
            <button
              className="btn btn--secondary btn--sm"
              onClick={addPodDomain}
              disabled={saving || !podDomainInput.trim()}
            >
              Add
            </button>
          </div>
        </div>

        <div className="settings-section">
          <label className="form-label">Preview Source Repos</label>
          <p className="settings-hint">
            Dry-run the source query with current settings to verify results
            before ingesting
          </p>
          <div className="settings-add-row">
            <button
              className="btn btn--secondary btn--sm"
              onClick={handlePreviewSourceRepos}
              disabled={sourceReposLoading}
            >
              {sourceReposLoading ? "Loading…" : "Fetch Preview"}
            </button>
          </div>
          {sourceReposError && (
            <div className="settings-error">{sourceReposError}</div>
          )}
          {sourceRepos !== null && (
            <div style={{ marginTop: 8 }}>
              <p className="settings-hint">
                {sourceRepos.length} repo(s) returned
              </p>
              <div style={{ maxHeight: 300, overflowY: "auto", fontSize: 12 }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th
                        style={{
                          textAlign: "left",
                          padding: "4px 8px",
                          borderBottom: "1px solid #ddd",
                        }}
                      >
                        Repo
                      </th>
                      <th
                        style={{
                          textAlign: "left",
                          padding: "4px 8px",
                          borderBottom: "1px solid #ddd",
                        }}
                      >
                        Branch
                      </th>
                      <th
                        style={{
                          textAlign: "left",
                          padding: "4px 8px",
                          borderBottom: "1px solid #ddd",
                        }}
                      >
                        Pod Domain
                      </th>
                      <th
                        style={{
                          textAlign: "left",
                          padding: "4px 8px",
                          borderBottom: "1px solid #ddd",
                        }}
                      >
                        SQ Event Date
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sourceRepos.map((r, i) => (
                      <tr key={i}>
                        <td style={{ padding: "4px 8px" }}>{r.githubRepo}</td>
                        <td style={{ padding: "4px 8px" }}>{r.githubBranch}</td>
                        <td style={{ padding: "4px 8px" }}>
                          {(r.payload as any)?.podDomain ?? "—"}
                        </td>
                        <td style={{ padding: "4px 8px" }}>
                          {(r.payload as any)?.sqEventCreatedAt
                            ? new Date(
                                (r.payload as any).sqEventCreatedAt,
                              ).toLocaleDateString()
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="settings-section">
          <label className="form-label">Default Confluence Viewer Emails</label>
          <p className="settings-hint">
            Added as viewers on all published Confluence pages
          </p>
          <div className="settings-list">
            {creationSetting?.defaultConfluenceEmails.map((email, i) => (
              <div key={i} className="settings-list-item">
                <code>{email}</code>
                <button
                  className="btn btn--danger btn--sm"
                  onClick={() => removeEmail(i)}
                  disabled={saving}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div className="settings-add-row">
            <input
              className="form-input"
              placeholder="user@company.com"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addEmail()}
            />
            <button
              className="btn btn--secondary btn--sm"
              onClick={addEmail}
              disabled={saving || !emailInput.trim()}
            >
              Add
            </button>
          </div>
        </div>
      </div>

      <div className="settings-card">
        <h3 className="settings-card__title">Model Routing</h3>
        <p className="settings-card__desc">
          Dynamically switch models per review phase to reduce cost. When disabled, all phases use the default model (PI_MODEL env var).
        </p>

        <div className="settings-toggles">
          <ToggleRow
            label="Routing Enabled"
            description="Switch models between Discovery, Review, and Summary phases"
            checked={routingSetting?.enabled ?? false}
            onChange={() => {
              if (!routingSetting) return;
              saveRoutingSetting({ ...routingSetting, enabled: !routingSetting.enabled });
            }}
            disabled={saving}
          />
        </div>

        {routingSetting && (
          <div className="settings-section">
            <label className="form-label">Phase Model Assignments</label>
            {(["discoveryModel", "reviewModel", "summaryModel", "diffModel", "inventoryModel"] as const).map((field) => {
              const labels: Record<string, string> = {
                discoveryModel: "Discovery (Phase 1)",
                reviewModel: "Review (Phase 2)",
                summaryModel: "Summary (Phase 3)",
                diffModel: "Diff Mode",
                inventoryModel: "MD Inventory",
              };
              return (
                <div key={field} className="settings-add-row" style={{ marginBottom: 8 }}>
                  <span style={{ minWidth: 140, fontSize: 13 }}>{labels[field]}</span>
                  <select
                    className="form-input"
                    value={routingSetting[field]}
                    onChange={(e) => saveRoutingSetting({ ...routingSetting, [field]: e.target.value })}
                    disabled={saving || !routingSetting.enabled}
                    style={{ flex: 1 }}
                  >
                    {BEDROCK_MODELS.map((m) => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {error && <div className="settings-error">{error}</div>}
      {saved && <div className="settings-saved">Saved</div>}
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
  disabled: boolean;
}) {
  return (
    <div className="toggle-row">
      <div className="toggle-row__text">
        <span className="toggle-row__label">{label}</span>
        <span className="toggle-row__desc">{description}</span>
      </div>
      <button
        className={`toggle-switch ${checked ? "toggle-switch--on" : ""}`}
        onClick={onChange}
        disabled={disabled}
        type="button"
      >
        <span className="toggle-switch__knob" />
      </button>
    </div>
  );
}
