import { useState, useEffect } from "react";
import { getSetting, updateSetting } from "../api/jobApi";
import "./SettingsPage.css";

interface JobSchedulerSetting {
  enabled: boolean;
  crawlers: {
    sqsIngestionEnabled: boolean;
    pendingJobCrawlerEnabled: boolean;
  };
}

export default function SettingsPage() {
  const [setting, setSetting] = useState<JobSchedulerSetting | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadSetting();
  }, []);

  const loadSetting = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getSetting("JOB_SCHEDULER_SETTING");
      setSetting(res.value as unknown as JobSchedulerSetting);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (
    path: "enabled" | "sqsIngestionEnabled" | "pendingJobCrawlerEnabled",
  ) => {
    if (!setting) return;

    const updated = { ...setting, crawlers: { ...setting.crawlers } };
    if (path === "enabled") {
      updated.enabled = !updated.enabled;
    } else {
      updated.crawlers[path] = !updated.crawlers[path];
    }

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
      // revert
      loadSetting();
    } finally {
      setSaving(false);
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

        {error && <div className="settings-error">{error}</div>}
        {saved && <div className="settings-saved">Saved</div>}
      </div>
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
