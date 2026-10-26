/**
 * Insights sales analytics throughDate identity helpers (MISE-005QJ).
 *
 * Pins domain-layer `buildInsightsSalesAnalytics` calendar-window through-date
 * prep outside the repository graph so Node tests can exercise inventing
 * proofs without loading Supabase or AsyncStorage. The prior path Unicode-
 * trimmed `input.throughDate` before storing it as the durable analytics
 * window end and deriving `windowStart` / units-trend keys
 * (`'\u20032026-08-01\u2003'.trim() === '2026-08-01'`,
 * `'\u00a02026-08-01\u00a0'.trim() === '2026-08-01'`).
 *
 * These are single-line ISO calendar-date window identities, not free-form
 * multiline prose. Only ASCII end trim is pinned. After ASCII prep, the value
 * must still match `YYYY-MM-DD` and parse as a real UTC calendar day;
 * Unicode-padded tokens soft to `null` so the live
 * `normalizeInsightsSalesThroughDate(...) || latestSaleDate(...)` fallthrough
 * stays intact rather than inventing equality with an unpadded date.
 *
 * Complements open Insights sales aggregation-label tip #869 / MISE-005QI,
 * Insights sales restaurant-workspace tip #781 / MISE-005MY, and Insights app
 * restaurant tip #740 / MISE-005LJ without sharing those modules or rewriting
 * `restaurantId.trim()` / label `normalizeLabel` on this path. Complements
 * open purchase-line ISO date tip #858 / MISE-005PX without sharing its
 * throw-closed ledger module — this tip owns only Insights sales analytics
 * soft throughDate window identity.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized Insights sales throughDate before it is
 * stored as the durable calendar-window end.
 */
export function asciiTrimInsightsSalesThroughDate(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

function isIsoCalendarDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/u.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  );
}

/**
 * Canonicalize an Insights sales throughDate under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, containing
 * ASCII controls, or not a real `YYYY-MM-DD` calendar day.
 */
export function canonicalizeInsightsSalesThroughDate(value: string): string | null {
  const trimmed = asciiTrimInsightsSalesThroughDate(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  if (!isIsoCalendarDate(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Insights sales analytics `throughDate` window identity.
 * Preserves soft empty → fallthrough to `latestSaleDate(...)` while refusing
 * to invent a clean ISO calendar date via Unicode em-space / NBSP trim.
 * Non-string, control-bearing, Unicode-padded, and non-ISO tokens soft to
 * `null`.
 */
export function normalizeInsightsSalesThroughDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (value === "") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those and fell through to latestSaleDate.
  if (!value.trim()) return null;
  return canonicalizeInsightsSalesThroughDate(value);
}
