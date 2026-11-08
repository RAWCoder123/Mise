/**
 * RecommendationDecisionRow suggested unit identity helpers (MISE-005AAI).
 *
 * Pins the Orders review free-form `recommendation.unit` interpolations that
 * previously always passed raw `recommendation.unit` into:
 * - `orders.recommendation.suggested` ({quantity} {unit}) in the expanded
 *   reason panel and the quantity hint;
 * - the adjacent quantity input / read-only unit Text;
 * - `orders.recommendation.quantityReadOnlyAccessibility` unit copy.
 *
 * A Unicode-only-space unit (`"\u2003"`) is non-nullish and truthy as a
 * purchase-recommendation field, so RecommendationDecisionRow still rendered
 * blank-looking unit identity in suggested copy (`"Suggested 12  "`) and
 * beside the quantity control. Empty string has the same blank-looking unit
 * path. Separately, Unicode `.trim()` on a padded unit
 * (`"\u2003cs\u2003".trim() === "cs"`) would invent a clean display unit
 * identity if that gate Unicode-trimmed before interpolating into
 * RecommendationDecisionRow suggested unit copy.
 *
 * Single-line unit tips use ASCII end trim only and preserve NBSP (no fold
 * into plain space). Soft-null when Unicode trim would still strip end
 * padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded unit. Accents and case are preserved. Full C0/DEL control
 * rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **orders.recommendation.unit.none** unit tokens
 * only — the RecommendationDecisionRow suggested display `recommendation.unit`
 * that falls through to that fallback when soft-null. Not
 * RecommendationDecisionRow item_name (#1055 / MISE-005WU), not
 * RecommendationDecisionRow reason (#1182 / MISE-005ZX), not Inventory hub
 * quantity unit (#1192 / MISE-005AAG), not Inventory detail unit (#1191 /
 * MISE-005AAF), not Scan Item quantity unit (#1193 / MISE-005AAH), not setup
 * inventory units (#861 / MISE-005QA), not inventory recipe-mapping units
 * (#864 / MISE-005QD), not inventory unit client helpers (#669 / MISE-005JA),
 * not purchase_recommendations.unit cntrl CHECK (#590 / MISE-005FZ), not
 * inventory_items.unit cntrl CHECK (#586 / MISE-005FV), and not controlled
 * inventory.ops.unit canonical labels. Soft empty / Unicode-padded /
 * control-bearing tokens soft-null so the live
 * `|| t("orders.recommendation.unit.none")` branch owns the intentional
 * localized fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1055 / #1182 / #1192 / #1191 / #1193 / #861 / #864 /
 * #669 / #590 / #586 without sharing those modules or rewriting their call
 * sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized RecommendationDecisionRow suggested unit
 * before it is rendered into suggested / quantity unit copy.
 */
export function asciiTrimRecommendationDecisionRowSuggestedUnit(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a RecommendationDecisionRow suggested unit under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeRecommendationDecisionRowSuggestedUnit(
  value: string
): string | null {
  const trimmed = asciiTrimRecommendationDecisionRowSuggestedUnit(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for RecommendationDecisionRow `recommendation.unit` display.
 * Preserves soft empty → null (intentional localized
 * orders.recommendation.unit.none copy) while refusing to invent a clean unit
 * via Unicode em-space / NBSP trim. Does not throw; Unicode-padded / unsafe /
 * non-string tokens return null so the live
 * `|| t("orders.recommendation.unit.none")` branch owns the fallback without
 * inventing a clean RecommendationDecisionRow suggested unit from padding,
 * and without letting non-nullish Unicode-only space or empty string render a
 * blank-looking unit through the prior always-pass suggested / quantity unit
 * paths.
 */
export function normalizeRecommendationDecisionRowSuggestedUnit(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered into RecommendationDecisionRow suggested /
  // quantity unit copy as a blank-looking unit identity.
  // Do not invent a clean RecommendationDecisionRow suggested unit from padding.
  if (!value.trim()) return null;
  return canonicalizeRecommendationDecisionRowSuggestedUnit(value);
}
