/** Comma-separated list; trailing slashes ignored (Origin never includes them). */
export function parseCorsOrigins(raw: string): string[] {
  return raw
    .split(",")
    .map(s => s.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}
