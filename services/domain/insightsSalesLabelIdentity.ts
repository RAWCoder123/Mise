/**
 * Insights sales analytics aggregation-label identity helpers (MISE-005QI).
 *
 * Pins domain-layer `buildInsightsSalesAnalytics` label prep outside the
 * repository graph so Node tests can exercise inventing proofs without
 * loading Supabase or AsyncStorage. The prior path Unicode-trimmed POS
 * `item_name` / `category` / `source_pos` tokens before collapsing
 * whitespace and using the result as a durable aggregation Map key
 * (`'\u2003Chicken Bowl\u2003'.trim() === 'Chicken Bowl'`).
 *
 * These are single-line scannable mix / best-seller labels, not free-form
 * multiline prose. Only ASCII end trim and ASCII internal whitespace
 * collapse are pinned; case and accents are left unchanged so presentation
 * stays operator-faithful. Empty, Unicode-padded, and control-bearing
 * tokens soft to `""` so callers keep the prior
 * `normalizeLabel(...) || "Uncategorized" | "POS" | "Item"` fallthrough
 * rather than inventing equality with an unpadded label.
 *
 * Complements open Insights restaurant-workspace tip #781 / MISE-005MY and
 * Insights app restaurant tip #740 / MISE-005LJ without sharing those
 * modules or rewriting `restaurantId.trim()` / `throughDate?.trim()` on
 * this path. Complements open operationalSignals demand-key tip #677 /
 * miseDomain insight demand-slug tip #704 without sharing those helpers —
 * this tip owns only Insights sales analytics aggregation labels.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized Insights sales aggregation label before
 * best-seller / mix Map keys are grouped.
 */
export function asciiTrimInsightsSalesLabel(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an Insights sales aggregation label under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeInsightsSalesLabel(value: string): string | null {
  const trimmed = asciiTrimInsightsSalesLabel(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed.replace(/[ \t\n\r\f\v]+/g, " ");
}

/**
 * Soft normalize for Insights sales `item_name` / `category` / `source_pos`
 * aggregation labels. Preserves soft empty → fallthrough (prior `.trim()`
 * emptiness + `|| "Uncategorized"|"POS"|"Item"`) while refusing to invent a
 * clean label via Unicode em-space / NBSP trim. Non-string and unsafe
 * tokens soft to `""`.
 */
export function normalizeInsightsSalesLabel(value: unknown): string {
  if (typeof value !== "string") return "";
  if (value === "") return "";
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those and fell through to the default mix / best-seller label.
  if (!value.trim()) return "";
  return canonicalizeInsightsSalesLabel(value) ?? "";
}
