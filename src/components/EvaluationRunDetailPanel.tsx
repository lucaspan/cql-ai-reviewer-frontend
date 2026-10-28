import { useState } from "react";
import type {
  EvaluationRunDetail,
  EvaluationStageResult,
  ScoredItem,
} from "../types/job.types";
import "./Modal.css";
import "./EvaluationModals.css";

type ItemList = "matched" | "missed" | "extra";

interface Props {
  run: EvaluationRunDetail;
  onClose: () => void;
  onExportPatch: (runId: string, itemKeys: string[]) => void;
}

function percent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

export default function EvaluationRunDetailPanel({
  run,
  onClose,
  onExportPatch,
}: Props) {
  const [openStage, setOpenStage] = useState<string | null>(
    run.stageResults[0]?.stage ?? null,
  );
  const [openList, setOpenList] = useState<ItemList>("missed");
  const [promoted, setPromoted] = useState<string[]>([]);

  const togglePromoted = (key: string) => {
    setPromoted((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key],
    );
  };

  const renderItems = (result: EvaluationStageResult) => {
    const { score } = result;
    const lists: Record<ItemList, ScoredItem[]> = {
      matched: score.matched.map((match) => match.expected),
      missed: score.missed,
      extra: score.extra,
    };
    const items = lists[openList];
    // Why the judge paired each item, so a match can be challenged rather than taken on trust.
    const rationaleByKey = new Map(
      score.matched.map((match) => [match.expected.key, match.rationale]),
    );

    if (!items.length)
      return <p className="eval-empty">Nothing in this list.</p>;

    return (
      <ul className="eval-items">
        {items.map((item) => (
          <li key={item.key} className="eval-item">
            {openList === "extra" && (
              <input
                type="checkbox"
                checked={promoted.includes(item.key)}
                onChange={() => togglePromoted(item.key)}
                aria-label={`Promote "${item.label}" to the golden dataset`}
              />
            )}
            <div>
              <span className="eval-item__label">{item.label}</span>
              {item.detail && (
                <span className="eval-item__detail">
                  {[item.detail.repo, item.detail.file, item.detail.severity]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              )}
              {openList === "matched" && rationaleByKey.get(item.key) && (
                <span className="eval-item__rationale">
                  {rationaleByKey.get(item.key)}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal eval-modal eval-modal--wide"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal__header">
          <h2>{run.label ?? run.id.slice(0, 8)}</h2>
          <button className="modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="modal__body eval-modal__body">
          <dl className="eval-totals">
            <div>
              <dt>Mean F1</dt>
              <dd>{percent(run.totals?.meanF1)}</dd>
            </div>
            <div>
              <dt>Cost</dt>
              <dd>${(run.totals?.totalCost ?? 0).toFixed(2)}</dd>
            </div>
          </dl>

          {run.error && <p className="eval-error">{run.error}</p>}

          <div className="eval-stages">
            {run.stageResults.map((result) => (
              <section key={result.stage} className="eval-stage">
                <button
                  className="eval-stage__head"
                  onClick={() =>
                    setOpenStage(
                      openStage === result.stage ? null : result.stage,
                    )
                  }
                >
                  <span className="eval-stage__name">
                    {result.stage.replace(/_/g, " ")}
                  </span>
                  <span className="eval-stage__scores">
                    F1 {percent(result.score.f1)} · P{" "}
                    {percent(result.score.precision)} · R{" "}
                    {percent(result.score.recall)}
                  </span>
                  <span
                    className={`evaluations__badge evaluations__badge--${result.score.status}`}
                  >
                    {result.score.status}
                  </span>
                </button>

                {openStage === result.stage && (
                  <div className="eval-stage__body">
                    {result.score.error && (
                      <p className="eval-error">{result.score.error}</p>
                    )}

                    {result.score.matching?.degraded && (
                      <p className="eval-error">
                        The match judge was unreachable, so nothing could be
                        paired. This score reflects a judging failure, not a
                        regression — re-run before drawing conclusions.
                        {result.score.matching.error && (
                          <>
                            <br />
                            <code>{result.score.matching.error}</code>
                          </>
                        )}
                      </p>
                    )}

                    {result.score.matching?.model &&
                      !result.score.matching.degraded && (
                        <p className="eval-hint">
                          {result.score.matching.model === "deterministic"
                            ? "Matched by path normalisation"
                            : `Matched by ${result.score.matching.model} (prompt v${result.score.matching.promptVersion})`}
                        </p>
                      )}

                    <div className="eval-tabs">
                      {(
                        [
                          ["matched", result.score.matched.length],
                          ["missed", result.score.missed.length],
                          ["extra", result.score.extra.length],
                        ] as [ItemList, number][]
                      ).map(([list, count]) => (
                        <button
                          key={list}
                          className={`eval-tab ${openList === list ? "eval-tab--on" : ""}`}
                          onClick={() => setOpenList(list)}
                        >
                          {list} ({count})
                        </button>
                      ))}
                    </div>

                    {renderItems(result)}

                    {Object.keys(result.score.fieldAccuracy).length > 0 && (
                      <dl className="eval-fields">
                        {Object.entries(result.score.fieldAccuracy).map(
                          ([field, value]) => (
                            <div key={field}>
                              <dt>{field}</dt>
                              <dd>{percent(value)}</dd>
                            </div>
                          ),
                        )}
                      </dl>
                    )}
                  </div>
                )}
              </section>
            ))}
          </div>
        </div>

        <footer className="modal__footer">
          <span className="eval-hint">
            Promoting writes nothing — it downloads a patch to merge via pull
            request.
          </span>
          <button
            className="eval-btn"
            disabled={!promoted.length}
            onClick={() => onExportPatch(run.id, promoted)}
          >
            Export dataset patch ({promoted.length})
          </button>
        </footer>
      </div>
    </div>
  );
}
