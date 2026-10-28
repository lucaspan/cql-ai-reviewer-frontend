import type {
  CostJobKind,
  CostRunKind,
  CostSource,
  CostTokens,
  JobCostRow,
} from "../types/cost.types";

export const COST_KINDS: CostJobKind[] = [
  "github_review",
  "commit_review",
  "project_knowledge",
  "evaluation",
];

export const KIND_LABEL: Record<CostJobKind, string> = {
  github_review: "GitHub review",
  commit_review: "Commit review",
  project_knowledge: "Threat modeling",
  evaluation: "Evaluation",
};

export const RUN_KIND_LABEL: Record<CostRunKind, string> = {
  review: "Review",
  follow_up: "Follow-up",
  collection: "Collection",
  evaluation: "Evaluation",
};

export const SOURCE_TOOLTIP: Record<CostSource, string> = {
  ledger: "Recorded by the LLM router",
  live: "Priced per turn while running",
  pi: "Priced from the model catalog (before the router)",
  evaluation: "Evaluation stage totals",
};

export function formatCost(cost: number): string {
  if (cost === 0) return "$0";
  const digits = Math.abs(cost) >= 1 ? 2 : 4;
  return `$${cost.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(2)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
  return String(tokens);
}

export function sumTokens(t: CostTokens): number {
  return t.input + t.cacheRead + t.cacheWrite + t.output;
}

export function tokenSplit(t: CostTokens): string {
  return `Input ${t.input.toLocaleString()} · Cache read ${t.cacheRead.toLocaleString()} · Cache write ${t.cacheWrite.toLocaleString()} · Output ${t.output.toLocaleString()}`;
}

// "us.anthropic.claude-opus-4-6-20250101-v1:0" -> "opus-4-6"
export function shortModel(id: string): string {
  return id
    .replace(/^(us|eu|apac|global)\./, "")
    .replace(/^anthropic\./, "")
    .replace(/^claude-/, "")
    .replace(/-\d{8}(-.*)?$/, "")
    .replace(/-v\d+(:\d+)?$/, "")
    .replace(/:\d+$/, "");
}

export function formatDateTime(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString() : "—";
}

export function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString() : "—";
}

const KNOWLEDGE_TYPE_LABEL: Record<string, string> = {
  security_scan: "Security scan",
  security_review: "Security review",
  gap_analysis: "Gap analysis",
  pentest_swarm: "Pentest swarm",
  threat_map: "Threat map",
  endpoint_inventory: "Endpoint inventory",
  repo_profile: "Repo profile",
  scan_summary: "Scan summary",
  security_test: "Security test",
  service_mapping: "Service mapping",
  runtime_topology: "Runtime topology",
  test_environment: "Test environment",
};

export function knowledgeTypeLabel(type: string | null): string {
  if (!type) return "";
  const label = KNOWLEDGE_TYPE_LABEL[type];
  if (label) return label;
  const spaced = type.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function entriesLabel(entries: number | null): string {
  return entries == null
    ? ""
    : `${entries} ${entries === 1 ? "entry" : "entries"}`;
}

export function kindBadge(row: JobCostRow): string {
  if (row.kind === "project_knowledge" && row.subtype)
    return `${KIND_LABEL[row.kind]} · ${knowledgeTypeLabel(row.subtype)}`;
  return row.kind === "github_review" && row.subtype
    ? `${KIND_LABEL[row.kind]} · ${row.subtype}`
    : KIND_LABEL[row.kind];
}

export function refLine(row: JobCostRow): string {
  if (row.kind === "project_knowledge")
    return [knowledgeTypeLabel(row.subtype), entriesLabel(row.entries)]
      .filter(Boolean)
      .join(" · ");
  return row.ref ?? "";
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
