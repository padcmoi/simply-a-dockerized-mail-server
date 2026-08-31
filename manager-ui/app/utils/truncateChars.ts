// Hard character cap for display: anything past `limit` characters is cut and
// replaced with an ellipsis, so a long value is reduced strongly regardless of
// the width of its container (the full value goes in a tooltip alongside).
export function truncateChars(value: string | null | undefined, limit = 40) {
  const s = value ?? "";
  return s.length > limit ? `${s.slice(0, limit).trimEnd()}…` : s;
}
