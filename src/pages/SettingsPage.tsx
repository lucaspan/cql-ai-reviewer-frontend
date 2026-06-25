import { useState, useEffect } from "react";
import {
  getSetting,
  updateSetting,
  getJobTypes,
  getSourceRepos,
  getAppCatPermissions,
  upsertAppCatPermission,
  deleteAppCatPermission,
} from "../api/jobApi";
import type { ReviewJobType, AppCatPermission } from "../types/job.types";
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

interface FindingsAnalysisValue {
  text: string;
  generatedAt: string;
  model: string;
  repoCount: number;
}

interface SummaryFindingsSetting {
  branchPatterns: string[];
  analysisModel: string;
  analysisPrompt: string;
  piiAnalysis: FindingsAnalysisValue | null;
  performanceAnalysis: FindingsAnalysisValue | null;
}

const BEDROCK_MODELS = [
  { id: "us.anthropic.claude-opus-4-5-20251101-v1:0", label: "Opus 4.5" },
  { id: "us.anthropic.claude-sonnet-4-5-20250929-v1:0", label: "Sonnet 4.5" },
  { id: "us.anthropic.claude-sonnet-4-6", label: "Sonnet 4.6" },
  { id: "us.anthropic.claude-haiku-4-5-20251001-v1:0", label: "Haiku 4.5" },
];

/** Lowercase + trim a single email. */
const normalizeEmail = (email: string): string => email.trim().toLowerCase();

/**
 * Parse a free-text blob of emails (newline/comma/space separated) into a
 * normalized, de-duplicated list. Used by the single-add inputs and batch paste.
 */
const parseEmails = (raw: string): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const token of raw.split(/[\s,;]+/)) {
    const email = normalizeEmail(token);
    if (email && !seen.has(email)) {
      seen.add(email);
      out.push(email);
    }
  }
  return out;
};

/** Merge new emails into an existing list, lowercased and de-duplicated. */
const mergeEmails = (existing: string[], incoming: string[]): string[] => {
  const seen = new Set(existing.map(normalizeEmail));
  const merged = [...existing.map(normalizeEmail)];
  for (const email of incoming) {
    const norm = normalizeEmail(email);
    if (norm && !seen.has(norm)) {
      seen.add(norm);
      merged.push(norm);
    }
  }
  return merged;
};

export default function SettingsPage() {
  const [setting, setSetting] = useState<JobSchedulerSetting | null>(null);
  const [creationSetting, setCreationSetting] =
    useState<JobCreationSetting | null>(null);
  const [routingSetting, setRoutingSetting] =
    useState<ModelRoutingSetting | null>(null);
  const [summarySetting, setSummarySetting] =
    useState<SummaryFindingsSetting | null>(null);
  const [appCatRows, setAppCatRows] = useState<AppCatPermission[]>([]);
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
      const [schedulerRes, creationRes, routingRes, summaryRes, appCatData] =
        await Promise.all([
          getSetting("JOB_SCHEDULER_SETTING"),
          getSetting("JOB_CREATION_SETTING"),
          getSetting("MODEL_ROUTING_SETTING"),
          getSetting("SUMMARY_FINDINGS_SETTING"),
          getAppCatPermissions(),
        ]);
      setSetting(schedulerRes.value as unknown as JobSchedulerSetting);
      setCreationSetting(creationRes.value as unknown as JobCreationSetting);
      setRoutingSetting(routingRes.value as unknown as ModelRoutingSetting);
      setSummarySetting(summaryRes.value as unknown as SummaryFindingsSetting);
      setAppCatRows(appCatData);
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

  const saveSummarySetting = async (updated: SummaryFindingsSetting) => {
    setSummarySetting(updated);
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await updateSetting(
        "SUMMARY_FINDINGS_SETTING",
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

  const reloadAppCat = async () => {
    try {
      setAppCatRows(await getAppCatPermissions());
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const saveAppCatRow = async (appCatId: string, stoEmails: string[], managerEmails: string[]) => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await upsertAppCatPermission({ appCatId, stoEmails, managerEmails });
      await reloadAppCat();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // appCat editor state
  const [appCatIdInput, setAppCatIdInput] = useState("");
  const [appCatStoInputs, setAppCatStoInputs] = useState<Record<string, string>>({});
  const [appCatMgrInputs, setAppCatMgrInputs] = useState<Record<string, string>>({});

  const addAppCatId = async () => {
    const id = appCatIdInput.trim();
    if (!id || appCatRows.some((r) => r.appCatId === id)) return;
    await saveAppCatRow(id, [], []);
    setAppCatIdInput("");
  };

  const removeAppCatId = async (id: string) => {
    setSaving(true);
    setError(null);
    try {
      await deleteAppCatPermission(id);
      await reloadAppCat();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const addStoEmail = (row: AppCatPermission) => {
    const incoming = parseEmails(appCatStoInputs[row.appCatId] ?? "");
    if (incoming.length === 0) return;
    saveAppCatRow(row.appCatId, mergeEmails(row.stoEmails, incoming), row.managerEmails);
    setAppCatStoInputs((prev) => ({ ...prev, [row.appCatId]: "" }));
  };

  const removeStoEmail = (row: AppCatPermission, email: string) => {
    saveAppCatRow(row.appCatId, row.stoEmails.filter((e) => e !== email), row.managerEmails);
  };

  const addMgrEmail = (row: AppCatPermission) => {
    const incoming = parseEmails(appCatMgrInputs[row.appCatId] ?? "");
    if (incoming.length === 0) return;
    saveAppCatRow(row.appCatId, row.stoEmails, mergeEmails(row.managerEmails, incoming));
    setAppCatMgrInputs((prev) => ({ ...prev, [row.appCatId]: "" }));
  };

  const removeMgrEmail = (row: AppCatPermission, email: string) => {
    saveAppCatRow(row.appCatId, row.stoEmails, row.managerEmails.filter((e) => e !== email));
  };

  const [appCatBatchOpen, setAppCatBatchOpen] = useState(false);
  const [appCatBatchText, setAppCatBatchText] = useState("");

  const applyAppCatBatch = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      for (const line of appCatBatchText.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        // Format: appCatId stoEmails managerEmails
        // Each field separated by whitespace. Emails comma-separated. Use "-" for none.
        const parts = trimmed.split(/\s+/);
        if (parts.length < 2) continue;
        const id = parts[0];
        const stoRaw = parts[1] ?? "-";
        const mgrRaw = parts[2] ?? "-";
        const stoNew = stoRaw === "-" ? [] : parseEmails(stoRaw);
        const mgrNew = mgrRaw === "-" ? [] : parseEmails(mgrRaw);
        if (!id) continue;
        const existing = appCatRows.find((r) => r.appCatId === id);
        await upsertAppCatPermission({
          appCatId: id,
          stoEmails: mergeEmails(existing?.stoEmails ?? [], stoNew),
          managerEmails: mergeEmails(existing?.managerEmails ?? [], mgrNew),
        });
      }
      await reloadAppCat();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
      setAppCatBatchText("");
      setAppCatBatchOpen(false);
    }
  };

  const [summaryBranchInput, setSummaryBranchInput] = useState("");

  const addSummaryBranchPattern = () => {
    if (!summarySetting || !summaryBranchInput.trim()) return;
    const pattern = summaryBranchInput.trim();
    if (summarySetting.branchPatterns.includes(pattern)) return;
    saveSummarySetting({
      ...summarySetting,
      branchPatterns: [...summarySetting.branchPatterns, pattern],
    });
    setSummaryBranchInput("");
  };

  const removeSummaryBranchPattern = (index: number) => {
    if (!summarySetting) return;
    saveSummarySetting({
      ...summarySetting,
      branchPatterns: summarySetting.branchPatterns.filter((_, i) => i !== index),
    });
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
    if (!creationSetting) return;
    const incoming = parseEmails(emailInput);
    if (incoming.length === 0) return;
    saveCreationSetting({
      ...creationSetting,
      defaultConfluenceEmails: mergeEmails(
        creationSetting.defaultConfluenceEmails,
        incoming,
      ),
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

      <div className="settings-card">
        <h3 className="settings-card__title">Summary Findings Pages</h3>
        <p className="settings-card__desc">
          Controls the Confluence "Findings Summary" rollup pages (PII,
          Performance Faults, Markdown Inventory). These pages show the latest
          completed review per branch.
        </p>

        <div className="settings-section">
          <label className="form-label">
            Included Branches — Patterns (regex)
          </label>
          <p className="settings-hint">
            A branch appears on the summary pages if it matches at least one
            pattern. Each repository's single most recent completed run is always
            included, even if its branch matches none of these.
          </p>
          <div className="settings-list">
            {summarySetting?.branchPatterns.map((pattern, i) => (
              <div key={i} className="settings-list-item">
                <code>{pattern}</code>
                <button
                  className="btn btn--danger btn--sm"
                  onClick={() => removeSummaryBranchPattern(i)}
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
              placeholder="^release/.*"
              value={summaryBranchInput}
              onChange={(e) => setSummaryBranchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addSummaryBranchPattern()}
            />
            <button
              className="btn btn--secondary btn--sm"
              onClick={addSummaryBranchPattern}
              disabled={saving || !summaryBranchInput.trim()}
            >
              Add
            </button>
          </div>
        </div>

        <div className="settings-section">
          <label className="form-label">AI Analysis Model</label>
          <p className="settings-hint">
            Model used to summarize repo review summaries into common incidents
            and anti-patterns. Runs only when the "Generate AI Analysis" action
            is triggered (incurs model cost).
          </p>
          <select
            className="form-input"
            value={summarySetting?.analysisModel ?? ""}
            onChange={(e) => {
              if (!summarySetting) return;
              saveSummarySetting({
                ...summarySetting,
                analysisModel: e.target.value,
              });
            }}
            disabled={saving || !summarySetting}
            style={{ maxWidth: 280 }}
          >
            {BEDROCK_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div className="settings-section">
          <label className="form-label">AI Analysis Prompt Template</label>
          <p className="settings-hint">
            Template variables: {"{{repoCount}}"}, {"{{typeDescription}}"}, {"{{summaries}}"}
          </p>
          <textarea
            className="form-input"
            rows={12}
            value={summarySetting?.analysisPrompt ?? ""}
            onChange={(e) => {
              if (!summarySetting) return;
              setSummarySetting({ ...summarySetting, analysisPrompt: e.target.value });
            }}
            onBlur={() => {
              if (!summarySetting) return;
              saveSummarySetting(summarySetting);
            }}
            disabled={saving || !summarySetting}
            style={{ fontFamily: "monospace", fontSize: 12 }}
          />
        </div>

        <div className="settings-section">
          <label className="form-label">Generated Analyses</label>
          <p className="settings-hint">
            Results from the last "Generate AI Analysis" run. Clear to remove from Confluence pages on next rebuild.
          </p>

          <div className="settings-analysis-result">
            <div className="settings-analysis-result__header">
              <strong>PII Analysis</strong>
              {summarySetting?.piiAnalysis && (
                <button
                  className="btn btn--danger btn--sm"
                  onClick={() => {
                    if (!summarySetting) return;
                    saveSummarySetting({ ...summarySetting, piiAnalysis: null });
                  }}
                  disabled={saving}
                >
                  Clear
                </button>
              )}
            </div>
            {summarySetting?.piiAnalysis ? (
              <div className="settings-analysis-result__meta">
                Generated {new Date(summarySetting.piiAnalysis.generatedAt).toLocaleString()} &middot;{" "}
                {summarySetting.piiAnalysis.repoCount} repos &middot;{" "}
                {BEDROCK_MODELS.find((m) => m.id === summarySetting.piiAnalysis?.model)?.label ?? summarySetting.piiAnalysis.model}
              </div>
            ) : (
              <div className="settings-analysis-result__meta">Not generated yet</div>
            )}
          </div>

          <div className="settings-analysis-result">
            <div className="settings-analysis-result__header">
              <strong>Performance Analysis</strong>
              {summarySetting?.performanceAnalysis && (
                <button
                  className="btn btn--danger btn--sm"
                  onClick={() => {
                    if (!summarySetting) return;
                    saveSummarySetting({ ...summarySetting, performanceAnalysis: null });
                  }}
                  disabled={saving}
                >
                  Clear
                </button>
              )}
            </div>
            {summarySetting?.performanceAnalysis ? (
              <div className="settings-analysis-result__meta">
                Generated {new Date(summarySetting.performanceAnalysis.generatedAt).toLocaleString()} &middot;{" "}
                {summarySetting.performanceAnalysis.repoCount} repos &middot;{" "}
                {BEDROCK_MODELS.find((m) => m.id === summarySetting.performanceAnalysis?.model)?.label ?? summarySetting.performanceAnalysis.model}
              </div>
            ) : (
              <div className="settings-analysis-result__meta">Not generated yet</div>
            )}
          </div>
        </div>
      </div>

      <div className="settings-card">
        <h3 className="settings-card__title">App Catalog Permissions</h3>
        <p className="settings-card__desc">
          Repos whose name ends with <code>_&lt;number&gt;</code> use that number as
          their App Catalog ID. STO and Manager emails mapped to an ID are added as{" "}
          <strong>viewers</strong> on that repo's Confluence pages. After editing,
          run "Refresh Page Permissions" to re-apply to existing pages.
        </p>

        <div className="settings-section">
          <div className="create-job-section__header">
            <label className="form-label">Batch Add</label>
            <button
              className="btn btn--secondary btn--sm"
              onClick={() => setAppCatBatchOpen((v) => !v)}
              disabled={saving}
            >
              {appCatBatchOpen ? "Cancel" : "Batch Add"}
            </button>
          </div>
          {appCatBatchOpen && (
            <>
              <p className="settings-hint">
                One per line: <code>appCatId stoEmails managerEmails</code>. Use <code>-</code> for none.
                Emails comma-separated. Lowercased, de-duplicated, merged with existing.
              </p>
              <textarea
                className="form-input"
                rows={5}
                placeholder={"12345 sto@bmo.com,sto2@bmo.com mgr@bmo.com\n67890 team@bmo.com -\n99999 - mgr@bmo.com"}
                value={appCatBatchText}
                onChange={(e) => setAppCatBatchText(e.target.value)}
                style={{ fontFamily: "monospace", fontSize: 12 }}
              />
              <div className="settings-add-row">
                <button
                  className="btn btn--primary btn--sm"
                  onClick={applyAppCatBatch}
                  disabled={saving || !appCatBatchText.trim()}
                >
                  Apply Batch
                </button>
              </div>
            </>
          )}
        </div>

        {appCatRows.length === 0 && (
          <p className="settings-hint">No App Catalog IDs configured yet.</p>
        )}

        {appCatRows.map((row) => (
          <div key={row.appCatId} className="settings-section">
            <div className="create-job-section__header">
              <label className="form-label">
                App Cat ID <code>{row.appCatId}</code>
              </label>
              <button
                className="btn btn--danger btn--sm"
                onClick={() => removeAppCatId(row.appCatId)}
                disabled={saving}
              >
                Remove ID
              </button>
            </div>

            <label className="form-label" style={{ fontSize: 12, marginTop: 8 }}>STO Emails</label>
            <div className="settings-list">
              {row.stoEmails.map((email) => (
                <div key={email} className="settings-list-item">
                  <code>{email}</code>
                  <button
                    className="btn btn--danger btn--sm"
                    onClick={() => removeStoEmail(row, email)}
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
                placeholder="sto@company.com"
                value={appCatStoInputs[row.appCatId] ?? ""}
                onChange={(e) =>
                  setAppCatStoInputs((prev) => ({ ...prev, [row.appCatId]: e.target.value }))
                }
                onKeyDown={(e) => e.key === "Enter" && addStoEmail(row)}
              />
              <button
                className="btn btn--secondary btn--sm"
                onClick={() => addStoEmail(row)}
                disabled={saving || !(appCatStoInputs[row.appCatId] ?? "").trim()}
              >
                Add
              </button>
            </div>

            <label className="form-label" style={{ fontSize: 12, marginTop: 8 }}>Manager Emails</label>
            <div className="settings-list">
              {row.managerEmails.map((email) => (
                <div key={email} className="settings-list-item">
                  <code>{email}</code>
                  <button
                    className="btn btn--danger btn--sm"
                    onClick={() => removeMgrEmail(row, email)}
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
                placeholder="manager@company.com"
                value={appCatMgrInputs[row.appCatId] ?? ""}
                onChange={(e) =>
                  setAppCatMgrInputs((prev) => ({ ...prev, [row.appCatId]: e.target.value }))
                }
                onKeyDown={(e) => e.key === "Enter" && addMgrEmail(row)}
              />
              <button
                className="btn btn--secondary btn--sm"
                onClick={() => addMgrEmail(row)}
                disabled={saving || !(appCatMgrInputs[row.appCatId] ?? "").trim()}
              >
                Add
              </button>
            </div>
          </div>
        ))}

        <div className="settings-section">
          <label className="form-label">Add App Catalog ID</label>
          <p className="settings-hint">The numeric suffix, e.g. <code>12345</code></p>
          <div className="settings-add-row">
            <input
              className="form-input"
              placeholder="12345"
              value={appCatIdInput}
              onChange={(e) => setAppCatIdInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addAppCatId()}
            />
            <button
              className="btn btn--secondary btn--sm"
              onClick={addAppCatId}
              disabled={saving || !appCatIdInput.trim()}
            >
              Add ID
            </button>
          </div>
        </div>
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
