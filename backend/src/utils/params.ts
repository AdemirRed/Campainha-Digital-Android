// Parses a route param that must be a positive integer id.
// Returns null for anything else (NaN, <= 0, non-integer, undefined).
export function parseId(raw: string | undefined): number | null {
  if (raw == null) return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}
