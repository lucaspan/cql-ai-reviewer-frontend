import type {
  GapAnalysisValue,
  ProjectFinding,
  ProjectKnowledge,
  ProjectRepo,
  SecurityReviewValue,
} from "../../types/job.types";

/** The threat-modeling pipeline, in the order a project goes through it: one tab each. */
export type StageId = "setup" | "threatMap" | "analysis" | "findings" | "testing";
export type StageState = "todo" | "running" | "done" | "failed";

export interface Stage {
  id: StageId;
  label: string;
  state: StageState;
  /** One line under the label, e.g. "2 repos · 4 of 4 ready". */
  summary: string;
}

/** Knowledge the threat map is built from, in the order to collect it. */
export const SETUP_TYPES = [
  "repo_profile",
  "endpoint_inventory",
  "service_mapping",
  "runtime_topology",
] as const;

const isSetupType = (t: string) => (SETUP_TYPES as readonly string[]).includes(t);

function stateOf(entries: ProjectKnowledge[]): StageState {
  if (entries.some((e) => e.status === "collecting")) return "running";
  if (entries.some((e) => e.status === "failed")) return "failed";
  if (entries.length > 0 && entries.every((e) => e.status === "active")) return "done";
  return "todo";
}

/** The threat map's data flows, from its graph file; null when there is no graph yet. */
export function threatMapGraph(
  entry: ProjectKnowledge | undefined,
): { nodes: unknown[]; edges: Array<{ type?: string }>; annotations?: unknown[] } | null {
  const files = (entry?.value as { files?: Array<{ filename: string; content: string }> } | undefined)
    ?.files;
  const file = files?.find((f) => f.filename === "threat-map-graph.json");
  if (!file) return null;
  try {
    return JSON.parse(file.content);
  } catch {
    return null;
  }
}

export function pipelineStages(
  repos: ProjectRepo[],
  knowledge: ProjectKnowledge[],
  findings: ProjectFinding[],
): Stage[] {
  // Setup: repositories and the knowledge the threat map is built from
  const setup = knowledge.filter((k) => isSetupType(k.knowledgeType));
  const ready = setup.filter((k) => k.status === "active").length;
  const hasBasics = ["repo_profile", "endpoint_inventory"].every((t) =>
    setup.some((k) => k.knowledgeType === t && k.status === "active"),
  );
  let setupState = repos.length ? stateOf(setup) : "todo";
  if (setupState === "done" && !hasBasics) setupState = "todo";

  // Threat map
  const map = knowledge.find((k) => k.knowledgeType === "threat_map");
  const graph = threatMapGraph(map);
  const flows = graph?.edges.filter((e) => e.type === "data_flow").length ?? 0;
  const mapState = map ? stateOf([map]) : "todo";

  // Analysis: the review (with its per-flow scans and tasks) and the gap analysis
  const review = knowledge.find((k) => k.knowledgeType === "security_review");
  const gap = knowledge.find((k) => k.knowledgeType === "gap_analysis");
  const scans = knowledge.filter((k) => k.knowledgeType === "security_scan");
  const perFlow = scans.filter((k) => k.key.startsWith("threat_map:"));
  const analysisEntries = [review, gap, ...scans].filter((k): k is ProjectKnowledge => !!k);
  let analysisState: StageState = "todo";
  if (analysisEntries.some((k) => k.status === "collecting")) analysisState = "running";
  else if (review?.status === "failed" || gap?.status === "failed") analysisState = "failed";
  else if (review?.status === "active") analysisState = "done";
  else if (perFlow.length && perFlow.every((k) => k.status === "active")) analysisState = "done";
  const reviewValue = (review?.value ?? {}) as SecurityReviewValue;
  const gapValue = (gap?.value ?? {}) as GapAnalysisValue;
  const analysisParts: string[] = [];
  if (reviewValue.runId) analysisParts.push(`${reviewValue.tasks?.length ?? 0} review tasks`);
  if (perFlow.length) {
    analysisParts.push(
      `${perFlow.filter((k) => k.status === "active").length}/${perFlow.length} flows scanned`,
    );
  }
  if (gapValue.runId) analysisParts.push(`gap: ${gapValue.rounds?.length ?? 0} round(s)`);

  // Findings: the reconciled list and the summary that writes it
  const summary = knowledge.find((k) => k.knowledgeType === "scan_summary");
  const open = findings.filter((f) => f.status === "open" || f.status === "confirmed").length;
  const findingsState: StageState = summary
    ? stateOf([summary])
    : findings.length
      ? "done"
      : "todo";

  // Testing: the target environment, security tests and pentest swarms
  const env = knowledge.find((k) => k.knowledgeType === "test_environment");
  const tests = knowledge.filter((k) => k.knowledgeType === "security_test");
  const swarms = knowledge.filter((k) => k.knowledgeType === "pentest_swarm");
  const testing = [...tests, ...swarms];
  let testingState: StageState = "todo";
  if (testing.some((k) => k.status === "collecting")) testingState = "running";
  else if (testing.some((k) => k.status === "failed")) testingState = "failed";
  else if (env?.status === "active" && testing.some((k) => k.status === "active"))
    testingState = "done";
  const validated = tests.filter((t) => (t.value as { result?: string })?.result === "validated");

  return [
    {
      id: "setup",
      label: "Setup",
      state: setupState,
      summary: repos.length
        ? `${repos.length} repo${repos.length === 1 ? "" : "s"} · ${ready} of ${setup.length} ready`
        : "Add repositories",
    },
    {
      id: "threatMap",
      label: "Threat Map",
      state: mapState,
      summary: !map
        ? "Not built"
        : map.status === "active"
          ? `${flows} data flow${flows === 1 ? "" : "s"}`
          : map.status === "collecting"
            ? "Building…"
            : map.status === "failed"
              ? "Failed"
              : "Not built",
    },
    {
      id: "analysis",
      label: "Analysis",
      state: analysisState,
      summary: analysisParts.join(" · ") || "Not run",
    },
    {
      id: "findings",
      label: "Findings",
      state: findingsState,
      summary: findings.length ? `${open} open of ${findings.length}` : "None yet",
    },
    {
      id: "testing",
      label: "Testing",
      state: testingState,
      summary:
        env?.status === "active"
          ? `${tests.length} test${tests.length === 1 ? "" : "s"}${validated.length ? `, ${validated.length} validated` : ""} · ${swarms.length} swarm${swarms.length === 1 ? "" : "s"}`
          : "Environment not set",
    },
  ];
}

/** Where to open a project: the first required step not done yet, else its findings. */
export function defaultStage(stages: Stage[]): StageId {
  return stages.find((s) => s.id !== "testing" && s.state !== "done")?.id ?? "findings";
}
