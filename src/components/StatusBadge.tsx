import { statusDisplay } from "../utils/status";
import "./StatusBadge.css";

/** The status pill every page uses. */
export default function StatusBadge({
  status,
  small = false,
  title,
}: {
  status: string | undefined;
  small?: boolean;
  title?: string;
}) {
  const { label, tone } = statusDisplay(status);
  return (
    <span
      className={`status-badge status-badge--${tone}${small ? " status-badge--sm" : ""}`}
      title={title}
    >
      {label}
    </span>
  );
}
