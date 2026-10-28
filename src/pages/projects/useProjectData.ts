import { useCallback, useEffect, useState } from "react";
import {
  getAgentSlots,
  getPentestSwarms,
  getProject,
  getProjectFindings,
  getProjectFindingStats,
  getProjectKnowledge,
  getTestEnvironment,
} from "../../api/jobApi";
import type { Project, ProjectFinding, ProjectKnowledge } from "../../types/job.types";

export interface EnvItem {
  key: string;
  value: string;
  description: string;
}

/**
 * Everything the project page shows, kept current: refreshed every 5 s while anything is
 * collecting, with how many agents run and wait, and a few more times after work stops.
 */
export function useProjectData(projectId: string) {
  const [project, setProject] = useState<Project | null>(null);
  const [knowledge, setKnowledge] = useState<ProjectKnowledge[]>([]);
  const [findings, setFindings] = useState<ProjectFinding[]>([]);
  const [findingStats, setFindingStats] = useState<Record<string, number>>({});
  const [envConfig, setEnvConfig] = useState<EnvItem[]>([]);
  const [swarms, setSwarms] = useState<ProjectKnowledge[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [p, k, f, fs, te, sw] = await Promise.all([
        getProject(projectId),
        getProjectKnowledge(projectId),
        getProjectFindings(projectId).catch(() => [] as ProjectFinding[]),
        getProjectFindingStats(projectId).catch(() => ({}) as Record<string, number>),
        getTestEnvironment(projectId).catch(() => null),
        getPentestSwarms(projectId).catch(() => [] as ProjectKnowledge[]),
      ]);
      setProject(p);
      setKnowledge(k);
      setFindings(f);
      setFindingStats(fs);
      setSwarms(sw);
      if (te) {
        try {
          const files = (te.value as { files?: Array<{ filename: string; content: unknown }> })
            ?.files;
          const envFile = files?.find((x) => x.filename === "test-environment.json");
          if (envFile) {
            setEnvConfig(
              (typeof envFile.content === "string"
                ? JSON.parse(envFile.content)
                : envFile.content) as EnvItem[],
            );
          }
        } catch {
          /* ignore a malformed environment file */
        }
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const anyCollecting = knowledge.some((k) => k.status === "collecting");
  const [agentSlots, setAgentSlots] = useState<{
    running: number;
    waiting: number;
    limit: number;
  } | null>(null);
  useEffect(() => {
    if (!anyCollecting) {
      // A finished step often starts the next one (a review starts the findings summary), so
      // look again a few times before going quiet
      const timers = [5_000, 15_000, 30_000].map((ms) => setTimeout(() => void refresh(), ms));
      return () => timers.forEach(clearTimeout);
    }
    const tick = () => {
      void refresh();
      getAgentSlots()
        .then(setAgentSlots)
        .catch(() => setAgentSlots(null));
    };
    tick();
    const interval = setInterval(tick, 5000);
    return () => clearInterval(interval);
  }, [anyCollecting, refresh]);

  /** "3 agent(s) running, 9 waiting for a slot (limit 4)", while anything is collecting. */
  const agentLine =
    anyCollecting && agentSlots
      ? `${agentSlots.running} agent(s) running, ${agentSlots.waiting} waiting for a slot (limit ${agentSlots.limit})`
      : null;

  return {
    project,
    knowledge,
    findings,
    findingStats,
    envConfig,
    setEnvConfig,
    swarms,
    loading,
    refresh,
    anyCollecting,
    agentLine,
  };
}
