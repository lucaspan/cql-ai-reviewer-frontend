/** `us.anthropic.claude-sonnet-4-5-20250929-v1:0` → "Sonnet 4.5"; other ids as they are. */
export function modelLabel(id: string): string {
  const m = /claude-(opus|sonnet|haiku)-(\d+)(?:-(\d)(?=[-:]|$))?/.exec(id);
  if (!m) return id;
  const family = m[1][0].toUpperCase() + m[1].slice(1);
  return `${family} ${m[3] ? `${m[2]}.${m[3]}` : m[2]}`;
}
