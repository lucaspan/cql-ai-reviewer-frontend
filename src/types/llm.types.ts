// Settings → Models: every LLM workload of the backend is a router policy `cql/<task>`.

export type WorkloadMode = "fixed" | "dynamic" | "shadow";

export interface DynamicTier {
  /** Short name the decider answers with, e.g. "fast". */
  name: string;
  model: string;
  /** When this tier is the right choice; shown to the decider. */
  use: string;
  effort?: string;
}

export interface LlmWorkload {
  task: string;
  group: string;
  groupLabel: string;
  label: string;
  policyName: string;
  /** false: no stored policy, so the router serves the fallback model. */
  configured: boolean;
  mode: WorkloadMode;
  /** fixed: the model that serves every request. */
  model: string | null;
  effort: string | null;
  /** Served when the model fails (fixed), or when the decider fails and in shadow mode. */
  fallbackModel: string;
  deciderModel: string | null;
  /** Cheapest first. */
  tiers: DynamicTier[];
  /** The stored policy has settings this page doesn't show (several candidates, a canary). */
  advanced: boolean;
}

export interface LlmModel {
  id: string;
  label: string;
  thinking: "adaptive" | "budget" | "adaptive-or-budget" | "none";
  /** Empty when the model takes no effort setting. */
  effortLevels: string[];
  contextWindow: number | null;
  maxOutputTokens: number | null;
  /** USD per million tokens. */
  price: { input: number; output: number; cacheRead: number };
}

export interface LlmWorkloads {
  workloads: LlmWorkload[];
  models: LlmModel[];
  /** Served for a workload without a policy. */
  fallbackModel: string;
}

export interface WorkloadSettings {
  mode: WorkloadMode;
  model?: string;
  effort?: string;
  fallbackModel?: string;
  deciderModel?: string;
  tiers?: DynamicTier[];
}

export interface ModelProbeResult {
  id: string;
  ok: boolean;
  latencyMs: number;
  status?: number;
  error?: string;
}

/** A model to serve instead of a workload's policy (evaluation runs). */
export interface RouterOverride {
  model: string;
  effort?: string;
}
