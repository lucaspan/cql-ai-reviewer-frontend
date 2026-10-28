import { useState } from "react";
import {
  createSecurityTestEntries,
  respondToKnowledgeQuestion,
  resetProjectKnowledge,
  saveTestEnvironment,
  startAllSecurityTests,
} from "../../../api/jobApi";
import type { ProjectFinding, ProjectKnowledge } from "../../../types/job.types";
import { EntryActions, IconX } from "../EntryActions";
import type { EnvItem } from "../useProjectData";
import { SwarmSection } from "./SwarmSection";

/** Masked in the form; the server encrypts the values of `auth.` and `secret.` keys. */
const isSecret = (key: string) => /^(auth|secret)\.|token|secret|password/i.test(key);

type TestValue = {
  result?: "validated" | "not_exploitable" | "not_testable";
  findingTitle?: string;
  findingSeverity?: string;
  findingRepo?: string;
  findingFile?: string;
  pendingQuestion?: {
    question: string;
    context?: string;
    field?: string;
    suggestedOptions?: string[];
  };
};

/** Step 5: tests against a running environment: the target, per-finding tests, pentest swarms. */
export function TestingTab({
  projectId,
  knowledge,
  findings,
  swarms,
  envConfig,
  setEnvConfig,
  refresh,
  onView,
}: {
  projectId: string;
  knowledge: ProjectKnowledge[];
  findings: ProjectFinding[];
  swarms: ProjectKnowledge[];
  envConfig: EnvItem[];
  setEnvConfig: (items: EnvItem[]) => void;
  refresh: () => Promise<void>;
  onView: (id: string) => void;
}) {
  const envActive = knowledge.some(
    (k) => k.knowledgeType === "test_environment" && k.status === "active",
  );
  const [envOpen, setEnvOpen] = useState(() => !envActive);
  const [saving, setSaving] = useState(false);
  const [answer, setAnswer] = useState<{ id: string; text: string } | null>(null);
  const [swarmConfig, setSwarmConfig] = useState({
    maxTokens: 500000,
    maxSpecialists: 5,
    maxDurationMinutes: 60,
  });
  const [swarmStarting, setSwarmStarting] = useState(false);

  const tests = knowledge.filter((k) => k.knowledgeType === "security_test");
  const testable = findings.filter((f) => f.status === "open" || f.status === "confirmed");
  const resultCount = (r: TestValue["result"]) =>
    tests.filter((t) => (t.value as TestValue).result === r).length;
  const needsInput = tests.filter((t) => t.status === "needs_info");

  return (
    <>
      <section className="pj-section">
        <div className="pj-section__head">
          <button className="pj-collapse" onClick={() => setEnvOpen((v) => !v)} aria-expanded={envOpen}>
            <span className={`pj-collapse__chevron ${envOpen ? "pj-collapse__chevron--open" : ""}`} aria-hidden="true">
              ›
            </span>
            <span>
              <span className="pj-section__title">Target Environment</span>
              <span className="pj-hint pj-collapse__summary">
                {envActive
                  ? `${envConfig.length} setting(s) saved`
                  : "Not set: tests and swarms need a running environment to test against"}
              </span>
            </span>
          </button>
        </div>
        {envOpen && (
          <>
            <p className="pj-hint">
              Where the running application is and how to sign in to it. Values of keys that start
              with <span className="pj-mono">auth.</span> or{" "}
              <span className="pj-mono">secret.</span> are stored encrypted, so name credentials
              that way (for example <span className="pj-mono">auth.password</span>).
            </p>
            {envConfig.length === 0 && (
              <div className="pj-inline-empty">
                No settings yet. Add the base URL, and the credentials of a test user.
              </div>
            )}
            {envConfig.length > 0 && (
            <table className="pj-table pj-table--compact">
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Value</th>
                  <th>Description</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {envConfig.map((item, i) => (
                  <tr key={i}>
                    <td>
                      <input
                        className="pj-input pj-mono"
                        value={item.key}
                        placeholder="BASE_URL"
                        aria-label="Key"
                        onChange={(e) => {
                          const c = [...envConfig];
                          c[i] = { ...c[i], key: e.target.value };
                          setEnvConfig(c);
                        }}
                      />
                    </td>
                    <td>
                      <input
                        className="pj-input"
                        type={isSecret(item.key) ? "password" : "text"}
                        value={item.value}
                        aria-label={`Value of ${item.key || "the new key"}`}
                        onChange={(e) => {
                          const c = [...envConfig];
                          c[i] = { ...c[i], value: e.target.value };
                          setEnvConfig(c);
                        }}
                      />
                    </td>
                    <td>
                      <input
                        className="pj-input"
                        value={item.description}
                        aria-label="Description"
                        onChange={(e) => {
                          const c = [...envConfig];
                          c[i] = { ...c[i], description: e.target.value };
                          setEnvConfig(c);
                        }}
                      />
                    </td>
                    <td className="pj-actions-cell">
                      <button
                        className="pj-icon-btn"
                        aria-label={`Remove ${item.key || "this setting"}`}
                        title="Remove"
                        onClick={() => setEnvConfig(envConfig.filter((_, j) => j !== i))}
                      >
                        <IconX />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            )}
            <div className="pj-row-actions">
              <button
                className="btn btn--secondary btn--sm"
                onClick={() => setEnvConfig([...envConfig, { key: "", value: "", description: "" }])}
              >
                + Add setting
              </button>
              <button
                className="btn btn--primary btn--sm"
                disabled={saving}
                onClick={async () => {
                  setSaving(true);
                  try {
                    await saveTestEnvironment(projectId, envConfig);
                    await refresh();
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                {saving ? "Saving…" : "Save environment"}
              </button>
            </div>
          </>
        )}
      </section>

      <section className="pj-section">
        <div className="pj-section__head">
          <div>
            <h3 className="pj-section__title">Security Tests</h3>
            <p className="pj-hint">
              An agent tries to exploit each open or confirmed finding against the environment and
              marks it validated, not exploitable, or not testable.
            </p>
          </div>
          <div className="pj-row-actions">
            {tests.some((k) => k.status === "pending" || k.status === "failed") && (
              <button
                className="btn btn--secondary btn--sm"
                onClick={async () => {
                  await startAllSecurityTests(projectId);
                  await refresh();
                }}
              >
                Run waiting tests
              </button>
            )}
            <button
              className="btn btn--primary btn--sm"
              disabled={!envActive || testable.length === 0}
              title={
                !envActive
                  ? "Set the target environment first"
                  : testable.length === 0
                    ? "No open or confirmed findings"
                    : `Create a test for each of the ${testable.length} open or confirmed findings`
              }
              onClick={async () => {
                await createSecurityTestEntries(projectId, testable.map((f) => f.id));
                await refresh();
              }}
            >
              Create tests for findings
            </button>
          </div>
        </div>

        {tests.length === 0 ? (
          <div className="pj-inline-empty">
            {envActive
              ? "No tests yet: create them for the open and confirmed findings."
              : "Set the target environment first, then create tests."}
          </div>
        ) : (
          <>
            <div className="pj-metrics">
              <span>{tests.length} test(s)</span>
              {resultCount("validated") > 0 && (
                <span className="pj-text-danger">{resultCount("validated")} validated</span>
              )}
              {resultCount("not_exploitable") > 0 && (
                <span className="pj-text-ok">{resultCount("not_exploitable")} not exploitable</span>
              )}
              {resultCount("not_testable") > 0 && <span>{resultCount("not_testable")} not testable</span>}
              {needsInput.length > 0 && (
                <span className="pj-text-warn">{needsInput.length} need your input</span>
              )}
            </div>
            <div className="pj-table-wrapper">
              <table className="pj-table pj-table--compact">
                <thead>
                  <tr>
                    <th>Finding</th>
                    <th>Status</th>
                    <th>Result</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {tests.map((t) => {
                    const tv = (t.value ?? {}) as TestValue;
                    const pq = t.status === "needs_info" ? tv.pendingQuestion : undefined;
                    return [
                      <tr key={t.id}>
                        <td>
                          <div>{tv.findingTitle ?? t.key}</div>
                          <div className="pj-hint">
                            {tv.findingSeverity} · {tv.findingRepo}/{tv.findingFile}
                          </div>
                        </td>
                        <td className="pj-col-status">
                          {t.status === "needs_info" ? (
                            <span className="pj-status pj-status--sm pj-status--pending pj-text-warn">
                              Needs input
                            </span>
                          ) : (
                            <span className={`pj-status pj-status--sm pj-status--${t.status === "active" ? "done" : t.status === "failed" ? "failed" : t.status === "collecting" ? "progress" : "pending"}`}>
                              {t.status === "active" ? "Done" : t.status === "collecting" ? "Running" : t.status === "failed" ? "Failed" : "Pending"}
                            </span>
                          )}
                        </td>
                        <td>
                          {tv.result === "validated" ? (
                            <span className="pj-pill pj-pill--critical">validated</span>
                          ) : tv.result === "not_exploitable" ? (
                            <span className="pj-pill pj-pill--resolved">not exploitable</span>
                          ) : tv.result === "not_testable" ? (
                            <span className="pj-pill pj-pill--muted">not testable</span>
                          ) : (
                            <span className="pj-muted">—</span>
                          )}
                        </td>
                        <td className="pj-actions-cell">
                          <EntryActions
                            projectId={projectId}
                            entry={t}
                            refresh={refresh}
                            onView={onView}
                            rerunLabel="Retest"
                            deleteMessage="Delete this security test?"
                          />
                        </td>
                      </tr>,
                      pq && (
                        <tr key={`${t.id}-question`} className="pj-question-row">
                          <td colSpan={4}>
                            <div className="pj-question">
                              <div>
                                <strong>The agent asks:</strong> {pq.question}
                              </div>
                              {pq.context && <div className="pj-hint">{pq.context}</div>}
                              {(pq.suggestedOptions?.length ?? 0) > 0 && (
                                <div className="pj-chips">
                                  {pq.suggestedOptions!.map((opt) => (
                                    <button
                                      key={opt}
                                      className="pj-chip"
                                      onClick={() => setAnswer({ id: t.id, text: opt })}
                                    >
                                      {opt}
                                    </button>
                                  ))}
                                </div>
                              )}
                              <div className="pj-row-actions">
                                <input
                                  className="pj-input"
                                  placeholder={`Answer${pq.field ? ` (${pq.field})` : ""}…`}
                                  aria-label="Answer"
                                  value={answer?.id === t.id ? answer.text : ""}
                                  onChange={(e) => setAnswer({ id: t.id, text: e.target.value })}
                                />
                                <button
                                  className="btn btn--primary btn--sm"
                                  disabled={answer?.id !== t.id || !answer.text.trim()}
                                  onClick={async () => {
                                    if (!answer) return;
                                    await respondToKnowledgeQuestion(projectId, t.id, answer.text);
                                    setAnswer(null);
                                    await refresh();
                                  }}
                                >
                                  Answer
                                </button>
                                <button
                                  className="btn btn--secondary btn--sm"
                                  onClick={async () => {
                                    await resetProjectKnowledge(projectId, t.id);
                                    await refresh();
                                  }}
                                >
                                  Skip
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ),
                    ];
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <SwarmSection
        projectId={projectId}
        swarms={swarms}
        knowledge={knowledge}
        swarmConfig={swarmConfig}
        setSwarmConfig={setSwarmConfig}
        swarmStarting={swarmStarting}
        setSwarmStarting={setSwarmStarting}
        refresh={refresh}
        setViewingKnowledgeId={onView}
      />
    </>
  );
}
