import { useState } from "react";
import { testModel } from "../api/jobApi";
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

  return (
    <div className="settings-page">
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
