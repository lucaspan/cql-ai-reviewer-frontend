import { useState } from "react";
import { testModel, dismissFinding, reactivateFinding } from "../api/jobApi";
import "./SettingsPage.css";

const BEDROCK_MODELS = [
  { id: "us.anthropic.claude-opus-4-8-v1", label: "Opus 4.8" },
  { id: "us.anthropic.claude-opus-4-7", label: "Opus 4.7" },
  { id: "us.anthropic.claude-opus-4-6-v1", label: "Opus 4.6" },
  { id: "us.anthropic.claude-opus-4-5-20251101-v1:0", label: "Opus 4.5" },
  { id: "us.anthropic.claude-sonnet-4-6", label: "Sonnet 4.6" },
  { id: "us.anthropic.claude-sonnet-4-5-20250929-v1:0", label: "Sonnet 4.5" },
  { id: "us.anthropic.claude-haiku-4-5-20251001-v1:0", label: "Haiku 4.5" },
];

export default function DevToolsPage() {
  const [modelId, setModelId] = useState(BEDROCK_MODELS[1].id);
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dismiss findings
  const [dismissIds, setDismissIds] = useState("");
  const [dismissReason, setDismissReason] = useState("");
  const [dismissing, setDismissing] = useState(false);
  const [dismissResult, setDismissResult] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    setResponse(null);
    try {
      const result = await testModel({ prompt: prompt.trim(), modelId });
      setResponse(result.response);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = async () => {
    const ids = dismissIds.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
    if (ids.length === 0) return;
    setDismissing(true);
    setDismissResult(null);
    try {
      let success = 0;
      let failed = 0;
      for (const id of ids) {
        try {
          await dismissFinding(id, dismissReason.trim() || undefined);
          success++;
        } catch {
          failed++;
        }
      }
      setDismissResult(`Done: ${success} dismissed, ${failed} failed`);
      setDismissIds("");
    } catch (err) {
      setDismissResult((err as Error).message);
    } finally {
      setDismissing(false);
    }
  };

  const handleReactivate = async () => {
    const ids = dismissIds.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
    if (ids.length === 0) return;
    setDismissing(true);
    setDismissResult(null);
    try {
      let success = 0;
      let failed = 0;
      for (const id of ids) {
        try {
          await reactivateFinding(id);
          success++;
        } catch {
          failed++;
        }
      }
      setDismissResult(`Done: ${success} reactivated, ${failed} failed`);
      setDismissIds("");
    } catch (err) {
      setDismissResult((err as Error).message);
    } finally {
      setDismissing(false);
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-card">
        <h3 className="settings-card__title">Dismiss / Reactivate Findings</h3>
        <p className="settings-card__desc">
          Enter one or more finding IDs (UUIDs) to dismiss or reactivate. One per line or comma-separated.
        </p>

        <div className="settings-section">
          <label className="form-label">Finding IDs</label>
          <textarea
            className="form-input"
            rows={4}
            placeholder={"e.g.\n550e8400-e29b-41d4-a716-446655440000\n6ba7b810-9dad-11d1-80b4-00c04fd430c8"}
            value={dismissIds}
            onChange={(e) => setDismissIds(e.target.value)}
            disabled={dismissing}
            style={{ fontFamily: "monospace", fontSize: 12 }}
          />
        </div>

        <div className="settings-section">
          <label className="form-label">Reason <span style={{ fontWeight: 400, color: "#999" }}>(optional, for dismiss only)</span></label>
          <input
            className="form-input"
            placeholder="e.g. accepted risk, false positive"
            value={dismissReason}
            onChange={(e) => setDismissReason(e.target.value)}
            disabled={dismissing}
          />
        </div>

        <div className="settings-section" style={{ display: "flex", gap: 8 }}>
          <button
            className="btn btn--primary btn--sm"
            onClick={handleDismiss}
            disabled={dismissing || !dismissIds.trim()}
          >
            {dismissing ? "Processing..." : "Dismiss"}
          </button>
          <button
            className="btn btn--secondary btn--sm"
            onClick={handleReactivate}
            disabled={dismissing || !dismissIds.trim()}
          >
            Reactivate
          </button>
        </div>

        {dismissResult && (
          <div className="settings-saved" style={{ marginTop: 12 }}>{dismissResult}</div>
        )}
      </div>

      <div className="settings-card">
        <h3 className="settings-card__title">Test Model</h3>
        <p className="settings-card__desc">
          Send a one-shot prompt to a Bedrock model and view the response.
        </p>

        <div className="settings-section">
          <label className="form-label">Model</label>
          <select
            className="form-input"
            value={BEDROCK_MODELS.some((m) => m.id === modelId) ? modelId : "__custom__"}
            onChange={(e) => setModelId(e.target.value === "__custom__" ? "" : e.target.value)}
            disabled={loading}
          >
            {BEDROCK_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} ({m.id})
              </option>
            ))}
            <option value="__custom__">Custom...</option>
          </select>
          {!BEDROCK_MODELS.some((m) => m.id === modelId) && (
            <input
              className="form-input"
              style={{ marginTop: 8 }}
              placeholder="us.anthropic.claude-..."
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              disabled={loading}
            />
          )}
        </div>

        <div className="settings-section">
          <label className="form-label">Prompt</label>
          <textarea
            className="form-input"
            rows={8}
            placeholder="Enter your prompt..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={loading}
            style={{ fontFamily: "monospace", fontSize: 13 }}
          />
        </div>

        <div className="settings-section">
          <button
            className="btn btn--primary"
            onClick={handleSubmit}
            disabled={loading || !prompt.trim()}
          >
            {loading ? "Running..." : "Send"}
          </button>
        </div>

        {error && <div className="settings-error">{error}</div>}

        {response !== null && (
          <div className="settings-section">
            <label className="form-label">Response</label>
            <pre
              style={{
                background: "#1e1e2e",
                color: "#cdd6f4",
                padding: 16,
                borderRadius: 8,
                overflow: "auto",
                maxHeight: 500,
                fontSize: 13,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {response}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
