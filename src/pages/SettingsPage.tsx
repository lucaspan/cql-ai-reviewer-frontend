import { useState, useEffect } from "react";
import { getSetting, updateSetting, getJobTypes } from "../api/jobApi";
import type { ReviewJobType } from "../types/job.types";
import "./SettingsPage.css";

interface RepoOverride {
  repo: string;
  branch?: string;
  jobTypes: string[];
}

interface JobSchedulerSetting {
  enabled: boolean;
  crawlers: {
    sqsIngestionEnabled: boolean;
    pendingJobCrawlerEnabled: boolean;
  };
  sqsJobCreation: {
    defaultJobTypes: string[];
    excludedRepos: string[];
    repoOverrides: RepoOverride[];
  };
}

const DEFAULT_SQS_CONFIG = {
  defaultJobTypes: ["PII", "PERFORMANCE", "MD_INVENTORY"],
  excludedRepos: [],
  repoOverrides: [],
};

export default function SettingsPage() {
  const [setting, setSetting] = useState<JobSchedulerSetting | null>(null);
  const [jobTypes, setJobTypes] = useState<ReviewJobType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadSetting();
    getJobTypes().then(setJobTypes).catch(() => {});
  }, []);

  const loadSetting = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getSetting("JOB_SCHEDULER_SETTING");
      const value = res.value as unknown as JobSchedulerSetting;
      if (!value.sqsJobCreation) {
        value.sqsJobCreation = DEFAULT_SQS_CONFIG;
      }
      setSetting(value);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const saveSetting = async (updated: JobSchedulerSetting) => {
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
      loadSetting();
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (
    path: "enabled" | "sqsIngestionEnabled" | "pendingJobCrawlerEnabled",
  ) => {
    if (!setting) return;
    const updated = { ...setting, crawlers: { ...setting.crawlers } };
    if (path === "enabled") {
      updated.enabled = !updated.enabled;
    } else {
      updated.crawlers[path] = !updated.crawlers[path];
    }
    saveSetting(updated);
  };

  const toggleDefaultJobType = (id: string) => {
    if (!setting) return;
    const current = setting.sqsJobCreation.defaultJobTypes;
    const next = current.includes(id)
      ? current.filter((t) => t !== id)
      : [...current, id];
    saveSetting({
      ...setting,
      sqsJobCreation: { ...setting.sqsJobCreation, defaultJobTypes: next },
    });
  };

  const [excludeInput, setExcludeInput] = useState("");

  const addExclusion = () => {
    if (!setting || !excludeInput.trim()) return;
    const value = excludeInput.trim();
    if (setting.sqsJobCreation.excludedRepos.includes(value)) return;
    const next = [...setting.sqsJobCreation.excludedRepos, value];
    saveSetting({
      ...setting,
      sqsJobCreation: { ...setting.sqsJobCreation, excludedRepos: next },
    });
    setExcludeInput("");
  };

  const removeExclusion = (index: number) => {
    if (!setting) return;
    const next = setting.sqsJobCreation.excludedRepos.filter(
      (_, i) => i !== index,
    );
    saveSetting({
      ...setting,
      sqsJobCreation: { ...setting.sqsJobCreation, excludedRepos: next },
    });
  };

  const [overrideRepo, setOverrideRepo] = useState("");
  const [overrideBranch, setOverrideBranch] = useState("");
  const [overrideTypes, setOverrideTypes] = useState<string[]>([]);

  const addOverride = () => {
    if (!setting || !overrideRepo.trim() || overrideTypes.length === 0) return;
    const repo = overrideRepo.trim();
    const branch = overrideBranch.trim() || undefined;
    const duplicate = setting.sqsJobCreation.repoOverrides.some(
      (o) => o.repo === repo && (o.branch ?? "") === (branch ?? ""),
    );
    if (duplicate) return;
    const newOverride: RepoOverride = { repo, branch, jobTypes: overrideTypes };
    const next = [...setting.sqsJobCreation.repoOverrides, newOverride];
    saveSetting({
      ...setting,
      sqsJobCreation: { ...setting.sqsJobCreation, repoOverrides: next },
    });
    setOverrideRepo("");
    setOverrideBranch("");
    setOverrideTypes([]);
  };

  const removeOverride = (index: number) => {
    if (!setting) return;
    const next = setting.sqsJobCreation.repoOverrides.filter(
      (_, i) => i !== index,
    );
    saveSetting({
      ...setting,
      sqsJobCreation: { ...setting.sqsJobCreation, repoOverrides: next },
    });
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
            label="SQS Ingestion"
            description="Poll SQS queue for new review jobs"
            checked={setting?.crawlers.sqsIngestionEnabled ?? false}
            onChange={() => handleToggle("sqsIngestionEnabled")}
            disabled={saving || !setting?.enabled}
          />
          <ToggleRow
            label="Pending Job Crawler"
            description="Automatically process pending jobs"
            checked={setting?.crawlers.pendingJobCrawlerEnabled ?? false}
            onChange={() => handleToggle("pendingJobCrawlerEnabled")}
            disabled={saving || !setting?.enabled}
          />
        </div>
      </div>

      <div className="settings-card">
        <h3 className="settings-card__title">SQS Auto-Creation</h3>
        <p className="settings-card__desc">
          Configure which job types are created when a message arrives from SQS.
        </p>

        <div className="settings-section">
          <label className="form-label">Default Job Types</label>
          <div className="settings-chips">
            {jobTypes.map((jt) => (
              <label key={jt.id} className="settings-chip">
                <input
                  type="checkbox"
                  checked={
                    setting?.sqsJobCreation.defaultJobTypes.includes(jt.id) ??
                    false
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
          <label className="form-label">Excluded Repos</label>
          <p className="settings-hint">
            Format: repo or repo:branch
          </p>
          <div className="settings-list">
            {setting?.sqsJobCreation.excludedRepos.map((item, i) => (
              <div key={i} className="settings-list-item">
                <code>{item}</code>
                <button
                  className="btn btn--danger btn--sm"
                  onClick={() => removeExclusion(i)}
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
              placeholder="repo-name or repo-name:branch"
              value={excludeInput}
              onChange={(e) => setExcludeInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addExclusion()}
            />
            <button
              className="btn btn--secondary btn--sm"
              onClick={addExclusion}
              disabled={saving || !excludeInput.trim()}
            >
              Add
            </button>
          </div>
        </div>

        <div className="settings-section">
          <label className="form-label">Repo Overrides</label>
          <p className="settings-hint">
            Override default job types for specific repos
          </p>
          <div className="settings-list">
            {setting?.sqsJobCreation.repoOverrides.map((item, i) => (
              <div key={i} className="settings-list-item">
                <code>
                  {item.repo}
                  {item.branch ? `:${item.branch}` : ""}{" "}
                </code>
                <span className="settings-override-types">
                  {item.jobTypes.join(", ")}
                </span>
                <button
                  className="btn btn--danger btn--sm"
                  onClick={() => removeOverride(i)}
                  disabled={saving}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div className="settings-override-form">
            <input
              className="form-input"
              placeholder="Repo"
              value={overrideRepo}
              onChange={(e) => setOverrideRepo(e.target.value)}
            />
            <input
              className="form-input"
              placeholder="Branch (optional)"
              value={overrideBranch}
              onChange={(e) => setOverrideBranch(e.target.value)}
            />
            <div className="settings-chips settings-chips--sm">
              {jobTypes.map((jt) => (
                <label key={jt.id} className="settings-chip">
                  <input
                    type="checkbox"
                    checked={overrideTypes.includes(jt.id)}
                    onChange={() =>
                      setOverrideTypes((prev) =>
                        prev.includes(jt.id)
                          ? prev.filter((t) => t !== jt.id)
                          : [...prev, jt.id],
                      )
                    }
                  />
                  <span>{jt.id}</span>
                </label>
              ))}
            </div>
            <button
              className="btn btn--secondary btn--sm"
              onClick={addOverride}
              disabled={
                saving || !overrideRepo.trim() || overrideTypes.length === 0
              }
            >
              Add Override
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
