import { useState } from "react";
import {
  createEndpointInventoryEntries,
  createRepoProfileEntries,
  createRuntimeTopologyEntry,
  createServiceMappingEntry,
  getProjectKnowledge,
  removeProjectRepo,
  startKnowledgeCollection,
} from "../../../api/jobApi";
import type { ProjectKnowledge, ProjectRepo } from "../../../types/job.types";
import { EntryActions, IconX } from "../EntryActions";
import { KnowledgeStatusBadge } from "../KnowledgeStatusBadge";
import { SETUP_TYPES } from "../pipeline";

type SetupType = (typeof SETUP_TYPES)[number];

const GROUPS: Record<
  SetupType,
  {
    label: string;
    hint: string;
    perRepo: boolean;
    create: (projectId: string) => Promise<unknown>;
  }
> = {
  repo_profile: {
    label: "Repo profiles",
    hint: "What each repository is: its stack, modules and entry points.",
    perRepo: true,
    create: createRepoProfileEntries,
  },
  endpoint_inventory: {
    label: "Endpoint inventories",
    hint: "Every endpoint each repository exposes, and the ones it calls.",
    perRepo: true,
    create: createEndpointInventoryEntries,
  },
  service_mapping: {
    label: "Service mapping",
    hint: "Optional, needs Dynatrace: which running services belong to these repositories.",
    perRepo: false,
    create: createServiceMappingEntry,
  },
  runtime_topology: {
    label: "Runtime topology",
    hint: "Optional, needs the service mapping: the calls between services Dynatrace observed.",
    perRepo: false,
    create: createRuntimeTopologyEntry,
  },
};

/** `repo:owner/name` as the repository's name; other keys as they are. */
function entryName(key: string): { name: string; owner?: string } {
  const m = /^repo:([^/]+)\/(.+)$/.exec(key);
  if (m) return { name: m[2], owner: m[1] };
  return { name: key === "system" ? "Whole system" : key };
}

/** Step 1: the repositories, and the knowledge the threat map is built from. */
export function SetupTab({
  projectId,
  repos,
  knowledge,
  refresh,
  onView,
  onAddRepo,
}: {
  projectId: string;
  repos: ProjectRepo[];
  knowledge: ProjectKnowledge[];
  refresh: () => Promise<void>;
  onView: (id: string) => void;
  onAddRepo: () => void;
}) {
  const [busy, setBusy] = useState<SetupType | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Creates the group's missing entries, then starts every one not run yet. */
  const createAndRun = async (type: SetupType) => {
    setBusy(type);
    setError(null);
    try {
      await GROUPS[type].create(projectId);
      const all = await getProjectKnowledge(projectId);
      for (const k of all.filter((x) => x.knowledgeType === type && x.status === "pending")) {
        await startKnowledgeCollection(projectId, k.id);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
      await refresh();
    }
  };

  const serviceMappingActive = knowledge.some(
    (k) => k.knowledgeType === "service_mapping" && k.status === "active",
  );

  return (
    <>
      <section className="pj-section">
        <div className="pj-section__head">
          <div>
            <h3 className="pj-section__title">Repositories</h3>
            <p className="pj-hint">All repositories are analysed together, as one system.</p>
          </div>
          <button className="btn btn--secondary btn--sm" onClick={onAddRepo}>
            + Add repository
          </button>
        </div>
        {repos.length === 0 ? (
          <div className="pj-inline-empty">
            No repositories yet. Add the repositories that make up the system.
          </div>
        ) : (
          <div className="pj-table-wrapper">
            <table className="pj-table">
              <thead>
                <tr>
                  <th>Repository</th>
                  <th>Branch</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {repos.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <span className="pj-muted">{r.githubOwner}/</span>
                      <span className="pj-mono">{r.githubRepo}</span>
                    </td>
                    <td className="pj-mono">{r.githubBranch}</td>
                    <td className="pj-actions-cell">
                      <button
                        className="pj-icon-btn"
                        aria-label={`Remove ${r.githubRepo}`}
                        title="Remove from the project"
                        onClick={async () => {
                          if (!confirm(`Remove ${r.githubRepo} from the project?`)) return;
                          await removeProjectRepo(projectId, r.id);
                          await refresh();
                        }}
                      >
                        <IconX />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="pj-section">
        <div className="pj-section__head">
          <div>
            <h3 className="pj-section__title">Knowledge</h3>
            <p className="pj-hint">
              Collected from the code (and Dynatrace) before the threat map. Repo profiles and
              endpoint inventories are needed; the rest is optional.
            </p>
          </div>
        </div>
        {error && <div className="pj-review-error">{error}</div>}

        {SETUP_TYPES.map((type, i) => {
          const g = GROUPS[type];
          const entries = knowledge.filter((k) => k.knowledgeType === type);
          const waiting = entries.filter((k) => k.status === "pending" || k.status === "failed");
          const missing = g.perRepo ? Math.max(0, repos.length - entries.length) : entries.length ? 0 : 1;
          const blocked = !repos.length
            ? "Add repositories first"
            : type === "runtime_topology" && !serviceMappingActive
              ? "Needs an active service mapping"
              : undefined;
          return (
            <div key={type} className="pj-group">
              <div className="pj-group__head">
                <div>
                  <div className="pj-group__title">
                    <span className="pj-group__num">{i + 1}</span>
                    {g.label}
                  </div>
                  <div className="pj-hint">{g.hint}</div>
                </div>
                <div className="pj-row-actions">
                  {waiting.length > 0 && missing === 0 && (
                    <button
                      className="btn btn--primary btn--sm"
                      disabled={busy !== null}
                      onClick={async () => {
                        setBusy(type);
                        try {
                          for (const k of waiting) await startKnowledgeCollection(projectId, k.id);
                        } finally {
                          setBusy(null);
                          await refresh();
                        }
                      }}
                    >
                      Run {waiting.length} waiting
                    </button>
                  )}
                  {missing > 0 && (
                    <button
                      className={`btn btn--sm ${type === "repo_profile" || type === "endpoint_inventory" ? "btn--primary" : "btn--secondary"}`}
                      disabled={busy !== null || !!blocked}
                      title={blocked}
                      onClick={() => createAndRun(type)}
                    >
                      {busy === type
                        ? "Starting…"
                        : entries.length
                          ? `Add ${missing} new repo${missing === 1 ? "" : "s"}`
                          : "Create and run"}
                    </button>
                  )}
                </div>
              </div>
              {entries.length > 0 && (
                <table className="pj-table pj-table--compact">
                  <tbody>
                    {entries.map((k) => {
                      const n = entryName(k.key);
                      return (
                        <tr key={k.id}>
                          <td title={k.key}>
                            {n.owner && <span className="pj-muted">{n.owner}/</span>}
                            <span className={n.owner ? "pj-mono" : undefined}>{n.name}</span>
                          </td>
                          <td className="pj-col-status">
                            <KnowledgeStatusBadge status={k.status} error={k.error} />
                          </td>
                          <td className="pj-col-version pj-muted">v{k.version}</td>
                          <td className="pj-actions-cell">
                            <EntryActions
                              projectId={projectId}
                              entry={k}
                              refresh={refresh}
                              onView={onView}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}
      </section>
    </>
  );
}
