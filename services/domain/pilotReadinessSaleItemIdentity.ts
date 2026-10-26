/**
 * Pilot readiness missing-recipe sale item-name identity helpers (MISE-005QO).
 *
 * Pins domain-layer `assessRecipeCoverage` missing-name Set prep outside the
 * repository graph so Node tests can exercise inventing proofs without loading
 * Supabase or AsyncStorage. The prior path Unicode-trimmed POS `sale.item_name`
 * before inserting the result into the missing-recipe blocker Set
 * (`'\u2003Chicken Bowl\u2003'.trim() === 'Chicken Bowl'`), so padded unmapped
 * sales invented equality with clean menu-item blocker keys.
 *
 * These are single-line scannable POS sale item names used only for missing
 * recipe blocker display, not free-form multiline prose and not the
 * `saleMatchesRecipe` coverage match itself. Only ASCII end trim is pinned;
 * case and accents are left unchanged so presentation stays operator-faithful.
 * Soft empty (ASCII whitespace or Unicode-only space) and Unicode-padded
 * non-empty tokens soft to `""` so callers can skip inventing a clean Set key
 * rather than collapsing padded and unpadded names.
 *
 * Complements open pilot-readiness restaurant-workspace tip #745 / MISE-005LO
 * and pilot-readiness supplier_id tip #826 / MISE-005OR without sharing those
 * modules or rewriting `restaurantId.trim()` / `supplier_id.trim()` /
 * recipient email emptiness checks on this path. Complements open Insights
 * sales aggregation-label tip #869 / MISE-005QI, setup POS itemName tip #872 /
 * MISE-005QL, and inventory recipe menuItemName tip #863 / MISE-005QC without
 * sharing those helpers — this tip owns only pilot readiness missing-recipe
 * sale item-name Set keys.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized missing-recipe sale item name before it is
 * stored in the blocker Set.
 */
export function asciiTrimPilotReadinessSaleItemName(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a pilot readiness missing-recipe sale item name under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizePilotReadinessSaleItemName(value: string): string | null {
  const trimmed = asciiTrimPilotReadinessSaleItemName(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for pilot readiness missing-recipe `sale.item_name` Set keys.
 * Preserves soft empty → skip Set insert (prior `.trim()` emptiness would
 * still produce an empty key that is useless in blockers) while refusing to
 * invent a clean label via Unicode em-space / NBSP trim. Non-string,
 * control-bearing, and Unicode-padded tokens soft to `""`.
 */
export function normalizePilotReadinessSaleItemName(value: unknown): string {
  if (typeof value !== "string") return "";
  if (value === "") return "";
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those into an empty Set key.
  if (!value.trim()) return "";
  return canonicalizePilotReadinessSaleItemName(value) ?? "";
}
