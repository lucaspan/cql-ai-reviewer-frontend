import type { EvaluationComparison, StageDelta } from "../types/job.types";
import "./Modal.css";
import "./EvaluationModals.css";

interface Props {
  comparison: EvaluationComparison;
  onClose: () => void;
}

function percent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

function DeltaCell({
  delta,
  invert = false,
}: {
  delta: number | null;
  invert?: boolean;
}) {
  if (delta === null) return <td>—</td>;
  if (Math.abs(delta) < 0.0001) return <td className="eval-delta">±0</td>;

  // On cost, lower is better, so the colour meaning flips.
  const improved = invert ? delta < 0 : delta > 0;
  const sign = delta > 0 ? "+" : "";
  return (
    <td
      className={
        improved ? "eval-delta eval-delta--up" : "eval-delta eval-delta--down"
      }
    >
      {sign}
      {invert ? `$${delta.toFixed(2)}` : `${(delta * 100).toFixed(1)}pp`}
    </td>
  );
}

export default function EvaluationComparePanel({ comparison, onClose }: Props) {
  const { base, target, stages } = comparison;

  const regressions = stages.filter((stage) => (stage.f1Delta ?? 0) < 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal eval-modal eval-modal--wide"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal__header">
          <h2>
            {base.label ?? base.id.slice(0, 8)} →{" "}
            {target.label ?? target.id.slice(0, 8)}
          </h2>
          <button className="modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="modal__body eval-modal__body">
          <p className="eval-hint">
            A difference smaller than this dataset's run-to-run spread is noise,
            not a change. Re-run the baseline a few times before trusting a
            small delta.
          </p>

          {regressions.length > 0 && (
            <p className="eval-error">
              {regressions.length} stage{regressions.length > 1 ? "s" : ""}{" "}
              regressed: {regressions.map((stage) => stage.stage).join(", ")}
            </p>
          )}

          <table className="evaluations__table">
            <thead>
              <tr>
                <th>Stage</th>
                <th>Base F1</th>
                <th>Target F1</th>
                <th>Δ F1</th>
                <th>Base cost</th>
                <th>Target cost</th>
                <th>Δ cost</th>
              </tr>
            </thead>
            <tbody>
              {stages.map((stage: StageDelta) => (
                <tr key={stage.stage}>
                  <td>{stage.stage.replace(/_/g, " ")}</td>
                  <td>{percent(stage.baseF1)}</td>
                  <td>{percent(stage.targetF1)}</td>
                  <DeltaCell delta={stage.f1Delta} />
                  <td>${stage.baseCost.toFixed(2)}</td>
                  <td>${stage.targetCost.toFixed(2)}</td>
                  <DeltaCell delta={stage.costDelta} invert />
                </tr>
              ))}
            </tbody>
          </table>

          {stages.map((stage) =>
            stage.gained.length || stage.lost.length ? (
              <section key={`${stage.stage}-items`} className="eval-stage">
                <h4 className="eval-stage__name">
                  {stage.stage.replace(/_/g, " ")}
                </h4>
                <div className="eval-compare-cols">
                  <div>
                    <h5>Newly found ({stage.gained.length})</h5>
                    <ul className="eval-items">
                      {stage.gained.map((item) => (
                        <li key={item.key} className="eval-item">
                          <span className="eval-item__label">{item.label}</span>
                        </li>
                      ))}
                      {!stage.gained.length && (
                        <li className="eval-empty">None</li>
                      )}
                    </ul>
                  </div>
                  <div>
                    <h5>No longer found ({stage.lost.length})</h5>
                    <ul className="eval-items">
                      {stage.lost.map((item) => (
                        <li key={item.key} className="eval-item">
                          <span className="eval-item__label">{item.label}</span>
                        </li>
                      ))}
                      {!stage.lost.length && (
                        <li className="eval-empty">None</li>
                      )}
                    </ul>
                  </div>
                </div>
              </section>
            ) : null,
          )}
        </div>
      </div>
    </div>
  );
}
