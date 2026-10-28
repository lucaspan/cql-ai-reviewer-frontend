export const formatUsd = (n: number | undefined) =>
  n === undefined ? "—" : n >= 1 ? `$${n.toFixed(2)}` : `$${n.toFixed(3)}`;

/** Prose without the "(F:F013#1)" finding references agents add; runs before the server stripped them. */
export const withoutRefs = (text: string) =>
  text
    .replace(/\s*[([](?:\s*(?:and\s+)?[RF]:[A-Za-z0-9_-]+#\d+\s*[,;&/]?)+\s*[)\]]/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

export const elapsed = (from?: string | null, to?: string | null) => {
  if (!from) return "";
  const ms = (to ? new Date(to).getTime() : Date.now()) - new Date(from).getTime();
  const min = Math.max(0, Math.round(ms / 60_000));
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`;
};
