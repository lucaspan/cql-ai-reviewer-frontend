import { useEffect, useState } from "react";
import { getLlmWorkloads, probeLlmModel, updateLlmWorkload } from "../api/jobApi";
import type {
  DynamicTier,
  LlmModel,
  LlmWorkload,
  ModelProbeResult,
  WorkloadMode,
  WorkloadSettings,
} from "../types/llm.types";
import "./ModelsSettings.css";

const MODE_LABEL: Record<WorkloadMode, string> = {
  fixed: "Fixed",
  dynamic: "Dynamic",
  shadow: "Shadow",
};

const MODE_HINT: Record<WorkloadMode, string> = {
  fixed: "Every request goes to one model.",
  dynamic:
    "At each new turn a cheap decider model picks a tier; the tool loop that follows stays on it. Pays off on single-shot calls (e.g. the judge), rarely on long agent sessions.",
  shadow:
    "Like dynamic, but only records the decider's pick and serves the fallback model. Use it to see what dynamic would choose before turning it on.",
};

const DEFAULT_TIERS: DynamicTier[] = [
  { name: "fast", model: "", use: "Simple, clear-cut work." },
  { name: "strong", model: "", use: "Hard or ambiguous work." },
];

/** Settings → Models: which model serves each LLM workload, all through the LLM router. */
export default function ModelsSettings() {
  const [workloads, setWorkloads] = useState<LlmWorkload[] | null>(null);
  const [models, setModels] = useState<LlmModel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [probes, setProbes] = useState<Record<string, ModelProbeResult | "running">>({});

  const load = () => {
    setError(null);
    getLlmWorkloads()
      .then((data) => {
        setWorkloads(data.workloads);
        setModels(data.models);
      })
      .catch((err: Error) => setError(err.message));
  };

  useEffect(load, []);

  const labelOf = (id: string | null) =>
    id ? (models.find((m) => m.id === id)?.label ?? id) : "—";

  const probe = async (id: string) => {
    setProbes((p) => ({ ...p, [id]: "running" }));
    try {
      const result = await probeLlmModel(id);
      setProbes((p) => ({ ...p, [id]: result }));
    } catch (err) {
      setProbes((p) => ({
        ...p,
        [id]: { id, ok: false, latencyMs: 0, error: (err as Error).message },
      }));
    }
  };

  const groups = workloads
    ? [...new Set(workloads.map((w) => w.group))].map((group) => ({
        group,
        label: workloads.find((w) => w.group === group)!.groupLabel,
        items: workloads.filter((w) => w.group === group),
      }))
    : [];

  return (
    <div className="settings-card settings-card--wide">
      <h3 className="settings-card__title">Models</h3>
      <p className="settings-card__desc">
        Every LLM call goes through the LLM router. Each workload has its own
        policy: a fixed model, or dynamic routing between tiers. Changes apply to
        the next request within 30 seconds, also in agents that are already
        running (their prompt cache is rebuilt once on the new model). A running
        agent whose context is too large for the new model stays on the
        fallback.
      </p>

      {error && (
        <div className="settings-error">
          {error}{" "}
          <button className="btn btn--secondary btn--sm" onClick={load}>
            Retry
          </button>
        </div>
      )}
      {!workloads && !error && <p className="settings-hint">Loading models…</p>}

      {groups.map(({ group, label, items }) => (
        <div key={group} className="models-group">
          <h4 className="models-group__title">{label}</h4>
          <table className="models-table models-table--workloads">
            <thead>
              <tr>
                <th>Workload</th>
                <th>Mode</th>
                <th>Model</th>
                <th>Effort</th>
                <th>Fallback</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((w) => (
                <WorkloadRows
                  key={w.task}
                  workload={w}
                  models={models}
                  labelOf={labelOf}
                  editing={editing === w.task}
                  onEdit={() => setEditing(editing === w.task ? null : w.task)}
                  onSaved={(updated) => {
                    setWorkloads((list) =>
                      list ? list.map((x) => (x.task === updated.task ? updated : x)) : list,
                    );
                    setEditing(null);
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {models.length > 0 && (
        <div className="settings-section">
          <label className="form-label">Available models</label>
          <p className="settings-hint">
            Models the router has a request profile and a price for. "Check access"
            makes one tiny call to confirm this AWS account can use the model.
          </p>
          <table className="models-table">
            <thead>
              <tr>
                <th>Model</th>
                <th>Thinking</th>
                <th>Effort levels</th>
                <th>Context</th>
                <th>$ / M in · out · cache read</th>
                <th style={{ width: 200 }}></th>
              </tr>
            </thead>
            <tbody>
              {models.map((m) => {
                const p = probes[m.id];
                return (
                  <tr key={m.id}>
                    <td>
                      <div>{m.label}</div>
                      <code className="models-id">{m.id}</code>
                    </td>
                    <td>{m.thinking}</td>
                    <td>{m.effortLevels.join(", ") || "—"}</td>
                    <td>{m.contextWindow ? `${m.contextWindow / 1000}K` : "—"}</td>
                    <td>
                      {m.price.input} · {m.price.output} · {m.price.cacheRead}
                    </td>
                    <td>
                      <button
                        className="btn btn--secondary btn--sm"
                        onClick={() => probe(m.id)}
                        disabled={p === "running"}
                      >
                        {p === "running" ? "Checking…" : "Check access"}
                      </button>
                      {p && p !== "running" && (
                        <span
                          className={`models-probe ${p.ok ? "models-probe--ok" : "models-probe--fail"}`}
                          title={p.error}
                        >
                          {p.ok ? `✓ ${p.latencyMs} ms` : `✗ ${p.status ?? ""} ${p.error ?? ""}`}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function WorkloadRows({
  workload,
  models,
  labelOf,
  editing,
  onEdit,
  onSaved,
}: {
  workload: LlmWorkload;
  models: LlmModel[];
  labelOf: (id: string | null) => string;
  editing: boolean;
  onEdit: () => void;
  onSaved: (updated: LlmWorkload) => void;
}) {
  const w = workload;
  return (
    <>
      <tr className={editing ? "models-row--editing" : undefined}>
        <td>
          <div>{w.label}</div>
          <code className="models-id">{w.policyName}</code>
          {!w.configured && <span className="models-tag">no policy</span>}
          {w.advanced && (
            <span className="models-tag" title="The stored policy has settings this page doesn't show; saving here replaces them">
              advanced
            </span>
          )}
        </td>
        <td>
          <span className={`models-mode models-mode--${w.mode}`}>{MODE_LABEL[w.mode]}</span>
        </td>
        <td>
          {w.mode === "fixed"
            ? labelOf(w.model)
            : w.tiers.map((t) => `${t.name}: ${labelOf(t.model)}`).join(" · ")}
          {w.mode !== "fixed" && (
            <div className="models-sub">decider {labelOf(w.deciderModel)}</div>
          )}
        </td>
        <td>
          {w.mode === "fixed"
            ? (w.effort ?? "default")
            : w.tiers.map((t) => t.effort ?? "default").join(" · ")}
        </td>
        <td>{labelOf(w.fallbackModel)}</td>
        <td>
          <button className="btn btn--secondary btn--sm" onClick={onEdit}>
            {editing ? "Close" : "Edit"}
          </button>
        </td>
      </tr>
      {editing && (
        <tr className="models-row--editor">
          <td colSpan={6}>
            <WorkloadEditor workload={w} models={models} onSaved={onSaved} onCancel={onEdit} />
          </td>
        </tr>
      )}
    </>
  );
}

function WorkloadEditor({
  workload,
  models,
  onSaved,
  onCancel,
}: {
  workload: LlmWorkload;
  models: LlmModel[];
  onSaved: (updated: LlmWorkload) => void;
  onCancel: () => void;
}) {
  const firstModel = models[0]?.id ?? "";
  const [mode, setMode] = useState<WorkloadMode>(workload.mode);
  const [model, setModel] = useState(workload.model ?? workload.fallbackModel);
  const [effort, setEffort] = useState(workload.effort ?? "");
  const [fallbackModel, setFallbackModel] = useState(workload.fallbackModel);
  const [deciderModel, setDeciderModel] = useState(
    workload.deciderModel ?? models.find((m) => m.label.startsWith("Haiku"))?.id ?? firstModel,
  );
  const [tiers, setTiers] = useState<DynamicTier[]>(
    workload.tiers.length ? workload.tiers : DEFAULT_TIERS.map((t) => ({ ...t, model: firstModel })),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setTier = (i: number, patch: Partial<DynamicTier>) =>
    setTiers((list) => list.map((t, j) => (j === i ? { ...t, ...patch } : t)));

  const save = async () => {
    const settings: WorkloadSettings =
      mode === "fixed"
        ? { mode, model, ...(effort ? { effort } : {}), fallbackModel }
        : {
            mode,
            fallbackModel,
            deciderModel,
            tiers: tiers.map((t) => ({
              name: t.name.trim(),
              model: t.model,
              use: t.use,
              ...(t.effort ? { effort: t.effort } : {}),
            })),
          };
    setSaving(true);
    setError(null);
    try {
      onSaved(await updateLlmWorkload(workload.task, settings));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="models-editor">
      <div className="models-editor__row">
        <span className="models-editor__label">Mode</span>
        <div className="models-modes">
          {(["fixed", "dynamic", "shadow"] as const).map((m) => (
            <label key={m} className="models-modes__option">
              <input type="radio" checked={mode === m} onChange={() => setMode(m)} />
              {MODE_LABEL[m]}
            </label>
          ))}
        </div>
      </div>
      <p className="settings-hint">{MODE_HINT[mode]}</p>

      {mode === "fixed" ? (
        <>
          <div className="models-editor__row">
            <span className="models-editor__label">Model</span>
            <ModelSelect
              models={models}
              value={model}
              onChange={(id) => {
                setModel(id);
                if (fallbackModel === model) setFallbackModel(id);
                if (!effortLevels(models, id).includes(effort)) setEffort("");
              }}
            />
          </div>
          <div className="models-editor__row">
            <span className="models-editor__label">Effort</span>
            <EffortSelect models={models} model={model} value={effort} onChange={setEffort} />
          </div>
        </>
      ) : (
        <>
          <div className="models-editor__row">
            <span className="models-editor__label">Decider</span>
            <ModelSelect models={models} value={deciderModel} onChange={setDeciderModel} />
          </div>
          <div className="models-editor__label" style={{ marginTop: 12 }}>
            Tiers (cheapest first)
          </div>
          {tiers.map((tier, i) => (
            <div key={i} className="models-tier">
              <input
                className="form-input models-tier__name"
                value={tier.name}
                placeholder="name"
                onChange={(e) => setTier(i, { name: e.target.value })}
              />
              <ModelSelect
                models={models}
                value={tier.model}
                onChange={(id) =>
                  setTier(i, {
                    model: id,
                    ...(tier.effort && !effortLevels(models, id).includes(tier.effort)
                      ? { effort: undefined }
                      : {}),
                  })
                }
              />
              <EffortSelect
                models={models}
                model={tier.model}
                value={tier.effort ?? ""}
                onChange={(e) => setTier(i, { effort: e || undefined })}
              />
              <textarea
                className="form-input models-tier__use"
                rows={2}
                value={tier.use}
                placeholder="When this tier is the right choice (shown to the decider)"
                onChange={(e) => setTier(i, { use: e.target.value })}
              />
              <button
                className="btn btn--danger btn--sm"
                onClick={() => setTiers((list) => list.filter((_, j) => j !== i))}
                disabled={tiers.length <= 2}
                title="Remove tier"
              >
                ✕
              </button>
            </div>
          ))}
          {tiers.length < 5 && (
            <button
              className="btn btn--secondary btn--sm"
              onClick={() =>
                setTiers((list) => [...list, { name: `tier${list.length + 1}`, model: firstModel, use: "" }])
              }
            >
              Add tier
            </button>
          )}
        </>
      )}

      <div className="models-editor__row" style={{ marginTop: 12 }}>
        <span className="models-editor__label">Fallback</span>
        <ModelSelect models={models} value={fallbackModel} onChange={setFallbackModel} />
      </div>
      <p className="settings-hint">
        {mode === "fixed"
          ? "Served if the model keeps failing (throttling, outage)."
          : "Served when the decider fails, and in shadow mode."}
      </p>

      {error && <div className="settings-error">{error}</div>}
      <div className="models-editor__actions">
        <button className="btn btn--primary btn--sm" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button className="btn btn--secondary btn--sm" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </div>
  );
}

const effortLevels = (models: LlmModel[], id: string): string[] =>
  models.find((m) => m.id === id)?.effortLevels ?? [];

function ModelSelect({
  models,
  value,
  onChange,
}: {
  models: LlmModel[];
  value: string;
  onChange: (id: string) => void;
}) {
  const known = models.some((m) => m.id === value);
  return (
    <select className="form-input models-select" value={value} onChange={(e) => onChange(e.target.value)}>
      {!known && <option value={value}>{value || "Pick a model"} (not available)</option>}
      {models.map((m) => (
        <option key={m.id} value={m.id}>
          {m.label}
        </option>
      ))}
    </select>
  );
}

function EffortSelect({
  models,
  model,
  value,
  onChange,
}: {
  models: LlmModel[];
  model: string;
  value: string;
  onChange: (effort: string) => void;
}) {
  const levels = effortLevels(models, model);
  if (!levels.length) return <span className="models-sub">no effort setting</span>;
  return (
    <select className="form-input models-select models-select--sm" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">default</option>
      {levels.map((l) => (
        <option key={l} value={l}>
          {l}
        </option>
      ))}
    </select>
  );
}
