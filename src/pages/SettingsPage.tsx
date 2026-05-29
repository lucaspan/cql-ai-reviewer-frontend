import { useState, useEffect } from "react";
import { getSetting, updateSetting, getJobTypes } from "../api/jobApi";
import type { ReviewJobType } from "../types/job.types";
import "./SettingsPage.css";

interface JobSchedulerSetting {
  enabled: boolean;
  crawlers: {
    pendingJobCrawlerEnabled: boolean;
  };
}

interface JobCreationSetting {
  defaultJobTypes: string[];
  dedupDays: number;
  defaultConfluenceEmails: string[];
}

export default function SettingsPage() {
  const [setting, setSetting] = useState<JobSchedulerSetting | null>(null);
  const [creationSetting, setCreationSetting] = useState<JobCreationSetting | null>(null);
  const [jobTypes, setJobTypes] = useState<ReviewJobType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadSettings();
    getJobTypes().then(setJobTypes).catch(() => {});
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const [schedulerRes, creationRes] = await Promise.all([
        getSetting("JOB_SCHEDULER_SETTING"),
        getSetting("JOB_CREATION_SETTING"),
      ]);
      setSetting(schedulerRes.value as unknown as JobSchedulerSetting);
      setCreationSetting(creationRes.value as unknown as JobCreationSetting);
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

  const handleToggle = (
    path: "enabled" | "pendingJobCrawlerEnabled",
  ) => {
    if (!setting) return;
    const updated = { ...setting, crawlers: { ...setting.crawlers } };
    if (path === "enabled") {
      updated.enabled = !updated.enabled;
    } else {
      updated.crawlers[path] = !updated.crawlers[path];
    }
    saveSchedulerSetting(updated);
  };

  const toggleDefaultJobType = (id: string) => {
    if (!creationSetting) return;
    const current = creationSetting.defaultJobTypes;
    const next = current.includes(id) ? current.filter((t) => t !== id) : [...current, id];
    saveCreationSetting({ ...creationSetting, defaultJobTypes: next });
  };

  const [emailInput, setEmailInput] = useState("");

  const addEmail = () => {
    if (!creationSetting || !emailInput.trim()) return;
    const email = emailInput.trim();
    if (creationSetting.defaultConfluenceEmails.includes(email)) return;
    saveCreationSetting({
      ...creationSetting,
      defaultConfluenceEmails: [...creationSetting.defaultConfluenceEmails, email],
    });
    setEmailInput("");
  };

  const removeEmail = (index: number) => {
    if (!creationSetting) return;
    saveCreationSetting({
      ...creationSetting,
      defaultConfluenceEmails: creationSetting.defaultConfluenceEmails.filter((_, i) => i !== index),
    });
  };

  const [dedupInput, setDedupInput] = useState("");




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
        </div>
      </div>


      <div className="settings-card">
        <h3 className="settings-card__title">Job Creation</h3>
        <p className="settings-card__desc">
          Default settings for job ingestion. Per-repo overrides are in Repo Config.
        </p>

        <div className="settings-section">
          <label className="form-label">Default Job Types</label>
          <p className="settings-hint">Applied when a repo has no matching repo_config entry</p>
          <div className="settings-chips">
            {jobTypes.map((jt) => (
              <label key={jt.id} className="settings-chip">
                <input
                  type="checkbox"
                  checked={creationSetting?.defaultJobTypes.includes(jt.id) ?? false}
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
          <p className="settings-hint">Skip ingestion if a job for same repo/branch/type was created within this many days</p>
          <div className="settings-add-row">
            <input
              className="form-input"
              type="number"
              min={1}
              value={dedupInput || (creationSetting?.dedupDays ?? 30)}
              onChange={(e) => setDedupInput(e.target.value)}
              onBlur={() => {
                const val = parseInt(dedupInput);
                if (creationSetting && val > 0 && val !== creationSetting.dedupDays) {
                  saveCreationSetting({ ...creationSetting, dedupDays: val });
                }
                setDedupInput("");
              }}
              style={{ width: 100 }}
            />
          </div>
        </div>

        <div className="settings-section">
          <label className="form-label">Default Confluence Viewer Emails</label>
          <p className="settings-hint">Added as viewers on all published Confluence pages</p>
          <div className="settings-list">
            {creationSetting?.defaultConfluenceEmails.map((email, i) => (
              <div key={i} className="settings-list-item">
                <code>{email}</code>
                <button className="btn btn--danger btn--sm" onClick={() => removeEmail(i)} disabled={saving}>✕</button>
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
            <button className="btn btn--secondary btn--sm" onClick={addEmail} disabled={saving || !emailInput.trim()}>
              Add
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
