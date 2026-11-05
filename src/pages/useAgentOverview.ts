import { useEffect, useState } from "react";
import { getAgentOverview } from "../api/jobApi";
import type { AgentOverview } from "../types/job.types";

const REFRESH_MS = 8000;

/** The Agents data, refreshed in the background. A failed refresh keeps the last data on screen. */
export function useAgentOverview(): { overview: AgentOverview | null; error: string | null } {
  const [overview, setOverview] = useState<AgentOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      getAgentOverview()
        .then((data) => {
          if (!alive) return;
          setOverview(data);
          setError(null);
        })
        .catch((err: Error) => {
          if (alive) setError(err.message);
        });
    void load();
    const interval = setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, []);

  return { overview, error };
}
