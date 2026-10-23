import { useEffect, useMemo, useState } from "react";
import { getCostSummary, getJobCosts, type CostFilter } from "../api/jobApi";
import type { CostJobKind, CostSummary, JobCostRow } from "../types/cost.types";
import type { PaginationMeta } from "../types/job.types";
import Pagination from "../components/Pagination";
import JobCostModal from "../components/JobCostModal";
import {
  COST_KINDS,
  KIND_LABEL,
  SOURCE_TOOLTIP,
  errorMessage,
  formatCost,
  formatDateTime,
  formatTokens,
  kindBadge,
  refLine,
  shortModel,
  sumTokens,
  tokenSplit,
} from "../utils/costFormat";
import "./CostsPage.css";

type RangePreset = "24h" | "7d" | "30d" | "90d" | "all";
type OrderBy = "createdAt" | "totalCost" | "lastRunAt";
type DayPoint = CostSummary["byDay"][number];

const RANGE_PRESETS: RangePreset[] = ["24h", "7d", "30d", "90d", "all"];
const RANGE_DAYS: Record<Exclude<RangePreset, "all">, number> = {
  "24h": 1,
  "7d": 7,
  "30d": 30,
  "90d": 90,
};
const ORDER_LABEL: Record<OrderBy, string> = {
  createdAt: "Created",
  lastRunAt: "Last run",
  totalCost: "Cost",
};
const DAY_MS = 24 * 60 * 60 * 1000;
const SEARCH_DEBOUNCE_MS = 300;
const DEFAULT_PAGE_SIZE = 20;
const MAX_MODELS_SHOWN = 2;
const TABLE_COLUMNS = 9;

interface Settled<T> {
  req: T;
  error: string | null;
}

function rangeFrom(preset: RangePreset): string | undefined {
  return preset === "all"
    ? undefined
    : new Date(Date.now() - RANGE_DAYS[preset] * DAY_MS).toISOString();
}

export default function CostsPage() {
  const [range, setRange] = useState<RangePreset>("30d");
  const [from, setFrom] = useState<string | undefined>(() => rangeFrom("30d"));
  const [kinds, setKinds] = useState<CostJobKind[]>(COST_KINDS);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [orderBy, setOrderBy] = useState<OrderBy>("createdAt");
  const [order, setOrder] = useState<"ASC" | "DESC">("DESC");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [reloadKey, setReloadKey] = useState(0);

  const [summary, setSummary] = useState<CostSummary | null>(null);
  const [rows, setRows] = useState<JobCostRow[] | null>(null);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  // Which request last settled; loading = the current request hasn't settled yet.
  const [summarySettled, setSummarySettled] = useState<Settled<unknown> | null>(
    null,
  );
  const [listSettled, setListSettled] = useState<Settled<unknown> | null>(null);
  const [selected, setSelected] = useState<JobCostRow | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const filter = useMemo<CostFilter>(
    () => ({
      kinds: kinds.length === COST_KINDS.length ? undefined : kinds,
      from,
      q: q || undefined,
    }),
    [from, kinds, q],
  );
  const summaryReq = useMemo(
    () => ({ filter, reloadKey }),
    [filter, reloadKey],
  );
  const listReq = useMemo(
    () => ({ filter, orderBy, order, page, limit, reloadKey }),
    [filter, orderBy, order, page, limit, reloadKey],
  );

  useEffect(() => {
    let cancelled = false;
    getCostSummary(summaryReq.filter)
      .then((data) => {
        if (cancelled) return;
        setSummary(data);
        setSummarySettled({ req: summaryReq, error: null });
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setSummarySettled({ req: summaryReq, error: errorMessage(e) });
      });
    return () => {
      cancelled = true;
    };
  }, [summaryReq]);

  useEffect(() => {
    let cancelled = false;
    const { filter: f, orderBy: ob, order: o, page: p, limit: l } = listReq;
    getJobCosts({ ...f, orderBy: ob, order: o, page: p, limit: l })
      .then((res) => {
        if (cancelled) return;
        setRows(res.data);
        setPagination(res.pagination);
        setListSettled({ req: listReq, error: null });
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setListSettled({ req: listReq, error: errorMessage(e) });
      });
    return () => {
      cancelled = true;
    };
  }, [listReq]);

  const summaryLoading = summarySettled?.req !== summaryReq;
  const listLoading = listSettled?.req !== listReq;
  const summaryError =
    !summaryLoading && summarySettled ? summarySettled.error : null;
  const listError = !listLoading && listSettled ? listSettled.error : null;

  const selectRange = (preset: RangePreset) => {
    setRange(preset);
    setFrom(rangeFrom(preset));
    setPage(1);
  };

  const toggleKind = (kind: CostJobKind) => {
    setKinds((prev) => {
      const next = prev.includes(kind)
        ? prev.filter((k) => k !== kind)
        : COST_KINDS.filter((k) => prev.includes(k) || k === kind);
      return next.length ? next : COST_KINDS;
    });
    setPage(1);
  };

  const onlyKind = (kind: CostJobKind) => {
    setKinds([kind]);
    setPage(1);
  };

  const sortBy = (col: OrderBy) => {
    if (col === orderBy) {
      setOrder((o) => (o === "DESC" ? "ASC" : "DESC"));
    } else {
      setOrderBy(col);
      setOrder("DESC");
    }
    setPage(1);
  };

  const retry = () => setReloadKey((k) => k + 1);
  const error = summaryError ?? listError;

  if (!summary && !rows) {
    if (error) {
      return (
        <div className="costs-state">
          <p className="costs-error">{error}</p>
          <button className="btn btn--secondary" onClick={retry}>
            Retry
          </button>
        </div>
      );
    }
    return <div className="costs-state">Loading costs...</div>;
  }

  const sortArrow = (col: OrderBy) =>
    orderBy === col ? (order === "DESC" ? " ↓" : " ↑") : "";
  const kindStats = (kind: CostJobKind) =>
    summary?.byKind.find((k) => k.kind === kind) ?? {
      kind,
      totalCost: 0,
      jobs: 0,
      runs: 0,
    };
  const isEmpty = summary?.jobs === 0;

  return (
    <div className="costs-content">
      <div className="costs-filters">
        <div className="costs-segmented" role="group" aria-label="Time range">
          {RANGE_PRESETS.map((preset) => (
            <button
              key={preset}
              className={`costs-segmented__btn ${range === preset ? "costs-segmented__btn--active" : ""}`}
              onClick={() => selectRange(preset)}
              aria-pressed={range === preset}
            >
              {preset === "all" ? "All" : preset}
            </button>
          ))}
        </div>

        <div className="costs-chips" role="group" aria-label="Job kinds">
          {COST_KINDS.map((kind) => (
            <button
              key={kind}
              className={`costs-chip ${kinds.includes(kind) ? "costs-chip--active" : ""}`}
              onClick={() => toggleKind(kind)}
              aria-pressed={kinds.includes(kind)}
            >
              {KIND_LABEL[kind]}
            </button>
          ))}
        </div>

        <input
          className="costs-search"
          type="search"
          placeholder="Repository, project, branch, commit or type"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search jobs"
        />

        <label className="costs-sort">
          <span>Sort</span>
          <select
            value={orderBy}
            onChange={(e) => sortBy(e.target.value as OrderBy)}
          >
            {(Object.keys(ORDER_LABEL) as OrderBy[]).map((col) => (
              <option key={col} value={col}>
                {ORDER_LABEL[col]}
              </option>
            ))}
          </select>
        </label>

        {(summaryLoading || listLoading) && (
          <span className="costs-loading">Updating…</span>
        )}
      </div>

      {error && (
        <div className="costs-error-bar">
          <span>{error}</span>
          <button className="btn btn--secondary btn--sm" onClick={retry}>
            Retry
          </button>
        </div>
      )}

      {summary && (
        <div className="costs-summary">
          <div className="costs-card">
            <span className="costs-card__value">
              {formatCost(summary.totalCost)}
            </span>
            <span className="costs-card__label">Total cost</span>
            <span className="costs-card__sub">
              {summary.jobs.toLocaleString()} jobs ·{" "}
              {summary.runs.toLocaleString()} runs
            </span>
          </div>
          <div className="costs-card">
            <span className="costs-card__value">
              {formatCost(summary.avgCostPerJob)}
            </span>
            <span className="costs-card__label">Avg per job</span>
          </div>
          {COST_KINDS.map((kind) => {
            const stats = kindStats(kind);
            return (
              <button
                key={kind}
                className="costs-card costs-card--clickable"
                onClick={() => onlyKind(kind)}
                title={`Show only ${KIND_LABEL[kind]}`}
              >
                <span className="costs-card__value">
                  {formatCost(stats.totalCost)}
                </span>
                <span className="costs-card__label">
                  {KIND_LABEL[kind]} · {stats.jobs.toLocaleString()} jobs
                </span>
              </button>
            );
          })}
        </div>
      )}

      {summary && <DailyCostChart summary={summary} />}

      {isEmpty ? (
        <div className="costs-state">
          <p>No jobs with recorded costs in this range.</p>
          {range !== "all" && (
            <button
              className="btn btn--secondary"
              onClick={() => selectRange("all")}
            >
              Show all time
            </button>
          )}
        </div>
      ) : (
        <>
          <div
            className={`costs-table-wrapper ${listLoading ? "costs-table-wrapper--loading" : ""}`}
          >
            <table className="costs-table">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Kind</th>
                  <th
                    className="costs-th--sortable"
                    onClick={() => sortBy("createdAt")}
                    aria-sort={
                      orderBy === "createdAt"
                        ? order === "DESC"
                          ? "descending"
                          : "ascending"
                        : undefined
                    }
                  >
                    Created{sortArrow("createdAt")}
                  </th>
                  <th>Runs</th>
                  <th>Models</th>
                  <th>Tokens</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th
                    className="costs-th--sortable costs-num"
                    onClick={() => sortBy("totalCost")}
                    aria-sort={
                      orderBy === "totalCost"
                        ? order === "DESC"
                          ? "descending"
                          : "ascending"
                        : undefined
                    }
                  >
                    Cost{sortArrow("totalCost")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows?.length === 0 && (
                  <tr>
                    <td colSpan={TABLE_COLUMNS} className="costs-empty">
                      No jobs on this page.
                    </td>
                  </tr>
                )}
                {rows?.map((row) => (
                  <JobRow
                    key={`${row.kind}:${row.id}`}
                    row={row}
                    onOpen={() => setSelected(row)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            meta={pagination}
            onPageChange={setPage}
            onLimitChange={(next) => {
              setLimit(next);
              setPage(1);
            }}
            disabled={listLoading}
          />
        </>
      )}

      <p className="costs-footnote">
        Costs are token costs at list prices, not the AWS invoice: no
        regional-endpoint premium, no contract discounts. Runs that crashed
        before finishing may be missing. Calls that belong to no job (e.g.
        Confluence summaries) are not included.
      </p>

      {selected && (
        <JobCostModal row={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

interface JobRowProps {
  row: JobCostRow;
  onOpen: () => void;
}

function JobRow({ row, onOpen }: JobRowProps) {
  return (
    <tr
      className="costs-row"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen();
      }}
    >
      <td>
        <div className="costs-job__title" title={row.title}>
          {row.title}
        </div>
        <div className="costs-muted costs-job__ref" title={refLine(row)}>
          {refLine(row)}
        </div>
      </td>
      <td>
        <span className="costs-type-badge">{kindBadge(row)}</span>
      </td>
      <td>
        <span title={row.kind === "project_knowledge" ? "Last run" : undefined}>
          {formatDateTime(row.createdAt)}
        </span>
      </td>
      <td>
        <span title={row.runs > 1 ? "incl. follow-ups/retries" : undefined}>
          {row.runs}
        </span>
      </td>
      <td>
        <ModelList models={row.models} />
      </td>
      <td>
        <span title={tokenSplit(row.tokens)}>
          {formatTokens(sumTokens(row.tokens))}
        </span>
      </td>
      <td>
        {row.costSources.map((s) => (
          <span key={s} className="costs-source" title={SOURCE_TOOLTIP[s]}>
            {s}
          </span>
        ))}
      </td>
      <td className="costs-muted">{row.status}</td>
      <td className="costs-cost costs-num">{formatCost(row.totalCost)}</td>
    </tr>
  );
}

function ModelList({ models }: { models: string[] }) {
  if (models.length === 0) return <span className="costs-muted">—</span>;
  const shown = models.slice(0, MAX_MODELS_SHOWN).map(shortModel);
  const extra = models.length - shown.length;
  return (
    <span className="costs-model" title={models.join("\n")}>
      {shown.join(", ")}
      {extra > 0 && ` +${extra}`}
    </span>
  );
}

// --- Daily chart (inline SVG) ---

const CHART_W = 800;
const CHART_H = 200;
const PAD_L = 64;
const PAD_R = 8;
const PAD_T = 12;
const PAD_B = 24;
const Y_TICKS = 3;
const MAX_X_LABELS = 8;
const BAR_FILL_RATIO = 0.7;

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseDay(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function fillDays(summary: CostSummary): DayPoint[] {
  const { byDay } = summary;
  if (byDay.length === 0) return [];
  const byKey = new Map(byDay.map((d) => [d.day, d]));
  const start = summary.from
    ? parseDay(dayKey(new Date(summary.from)))
    : parseDay(byDay[0].day);
  const endRef = summary.from
    ? parseDay(dayKey(summary.to ? new Date(summary.to) : new Date()))
    : null;
  const lastDay = parseDay(byDay[byDay.length - 1].day);
  const end = endRef && endRef > lastDay ? endRef : lastDay;
  const out: DayPoint[] = [];
  for (
    let d = start;
    d <= end;
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
  ) {
    const key = dayKey(d);
    out.push(byKey.get(key) ?? { day: key, totalCost: 0, jobs: 0 });
  }
  return out;
}

function niceStep(max: number, count: number): number {
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return nice * mag;
}

function DailyCostChart({ summary }: { summary: CostSummary }) {
  const [hover, setHover] = useState<number | null>(null);
  const days = useMemo(() => fillDays(summary), [summary]);
  const max = Math.max(0, ...days.map((d) => d.totalCost));
  if (days.length <= 1 || max <= 0) return null;

  const step = niceStep(max, Y_TICKS);
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from(
    { length: Math.round(top / step) + 1 },
    (_, i) => i * step,
  );
  const plotW = CHART_W - PAD_L - PAD_R;
  const plotH = CHART_H - PAD_T - PAD_B;
  const slot = plotW / days.length;
  const barW = slot * BAR_FILL_RATIO;
  const y = (v: number) => PAD_T + plotH - (v / top) * plotH;
  const labelEvery = Math.ceil(days.length / MAX_X_LABELS);
  const hovered = hover != null ? days[hover] : null;

  return (
    <div className="costs-chart">
      <div className="costs-chart__title">Daily cost</div>
      <div className="costs-chart__plot">
        <svg
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          role="img"
          aria-label="Daily cost chart"
          onMouseLeave={() => setHover(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD_L}
                x2={CHART_W - PAD_R}
                y1={y(t)}
                y2={y(t)}
                className="costs-chart__grid"
              />
              <text
                x={PAD_L - 6}
                y={y(t)}
                className="costs-chart__ylabel"
                textAnchor="end"
                dominantBaseline="middle"
              >
                {formatCost(t)}
              </text>
            </g>
          ))}
          {days.map((d, i) => {
            const x = PAD_L + i * slot;
            return (
              <g key={d.day} onMouseEnter={() => setHover(i)}>
                <rect
                  x={x}
                  y={PAD_T}
                  width={slot}
                  height={plotH}
                  fill="transparent"
                />
                <rect
                  x={x + (slot - barW) / 2}
                  y={y(d.totalCost)}
                  width={barW}
                  height={PAD_T + plotH - y(d.totalCost)}
                  className={`costs-chart__bar ${hover === i ? "costs-chart__bar--hover" : ""}`}
                />
                {i % labelEvery === 0 && (
                  <text
                    x={x + slot / 2}
                    y={CHART_H - 6}
                    className="costs-chart__xlabel"
                    textAnchor="middle"
                  >
                    {parseDay(d.day).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {hovered && hover != null && (
          <div
            className="costs-chart__tooltip"
            style={{
              left: `${((PAD_L + (hover + 0.5) * slot) / CHART_W) * 100}%`,
            }}
          >
            <strong>{parseDay(hovered.day).toLocaleDateString()}</strong>
            <span>{formatCost(hovered.totalCost)}</span>
            <span>{hovered.jobs} jobs</span>
          </div>
        )}
      </div>
    </div>
  );
}
