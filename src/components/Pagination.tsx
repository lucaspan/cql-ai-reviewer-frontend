import type { PaginationMeta } from "../types/job.types";
import "./Pagination.css";

interface PaginationProps {
  meta: PaginationMeta | null;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  pageSizeOptions?: number[];
  disabled?: boolean;
}

const DEFAULT_PAGE_SIZES = [20, 50, 100];

/**
 * Pagination control bar. Renders a per-page selector, a result range summary,
 * and prev/next buttons. Designed to sit directly below a data table.
 */
export default function Pagination({
  meta,
  onPageChange,
  onLimitChange,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
  disabled = false,
}: PaginationProps) {
  if (!meta) return null;

  const { page, limit, total, totalPages, hasNext, hasPrevious } = meta;

  // Result range, e.g. "21–40 of 137".
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="pagination" role="navigation" aria-label="Pagination">
      <div className="pagination__left">
        {onLimitChange && (
          <label className="pagination__pagesize">
            <span>Per page</span>
            <select
              value={limit}
              onChange={(e) => onLimitChange(Number(e.target.value))}
              disabled={disabled}
              aria-label="Results per page"
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}
        <span className="pagination__range" aria-live="polite">
          {from}–{to} of {total.toLocaleString()}
        </span>
      </div>

      <div className="pagination__controls">
        <button
          className="btn btn--secondary btn--sm"
          onClick={() => onPageChange(page - 1)}
          disabled={disabled || !hasPrevious}
          aria-label="Previous page"
        >
          ← Prev
        </button>
        <span className="pagination__pageinfo">
          Page {page} of {Math.max(totalPages, 1)}
        </span>
        <button
          className="btn btn--secondary btn--sm"
          onClick={() => onPageChange(page + 1)}
          disabled={disabled || !hasNext}
          aria-label="Next page"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
