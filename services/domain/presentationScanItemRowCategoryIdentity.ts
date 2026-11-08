/**
 * Scan Item row meta category identity helpers (MISE-005AAE).
 *
 * Pins the Scan Item OperationalRow subtitle category interpolation that
 * previously always passed raw `item.category` into
 * `t("scanItem.row.meta", { category: item.category, code: item.id })`.
 *
 * A Unicode-only-space category (`"\u2003"`) is non-nullish and truthy as an
 * inventory-item field, so the Scan Item row meta still rendered a
 * blank-looking category identity before the code separator (`"  · abc"`).
 * Empty string has the same blank-looking category path (`" · abc"`).
 * Separately, Unicode `.trim()` on a padded category
 * (`"\u2003Produce\u2003".trim() === "Produce"`) would invent a clean
 * display category identity if that gate Unicode-trimmed before
 * interpolating into `scanItem.row.meta`.
 *
 * Single-line category tips use ASCII end trim only and preserve NBSP (no fold
 * into plain space). Soft-null when Unicode trim would still strip end padding
 * (NBSP / em-space) so padding cannot invent equality with an unpadded
 * category. Accents and case are preserved. Full C0/DEL control rejection
 * applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **scanItem.row.category.none** category tokens
 * only — the Scan Item row meta `item.category` that falls through to that
 * fallback when soft-null. Not Scan Item row item.item_name (#1061 /
 * MISE-005XA), not Inventory detail subtitle category (#1189 /
 * MISE-005AAD), not Inventory categoryIcon classify (#701 / MISE-005KF),
 * not setup POS itemName/category (#872 / MISE-005QL), not Square catalog
 * category (#952 / MISE-005TN), and not Scan Item search/filter haystack
 * matching. Soft empty / Unicode-padded / control-bearing tokens soft-null
 * so the live `|| t("scanItem.row.category.none")` branch owns the
 * intentional localized fallback. Ordinary ASCII whitespace still trims
 * clean.
 *
 * Complements open #1061 / #1189 / #701 / #872 / #952 without sharing those
 * modules or rewriting their call sites. #1061 / #1189 explicitly left this
 * Scan Item row meta category path alone.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Scan Item row category before it is
 * rendered into `scanItem.row.meta`.
 */
export function asciiTrimScanItemRowCategory(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Scan Item row category under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeScanItemRowCategory(
  value: string
): string | null {
  const trimmed = asciiTrimScanItemRowCategory(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Scan Item row meta `item.category` display.
 * Preserves soft empty → null (intentional localized
 * scanItem.row.category.none copy) while refusing to invent a clean
 * category via Unicode em-space / NBSP trim. Does not throw;
 * Unicode-padded / unsafe / non-string tokens return null so the live
 * `|| t("scanItem.row.category.none")` branch owns the fallback
 * without inventing a clean Scan Item row category from padding, and
 * without letting non-nullish Unicode-only space or empty string render a
 * blank-looking category through the prior always-pass-name meta.
 */
export function normalizeScanItemRowCategory(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered into scanItem.row.meta as a blank-looking
  // category identity before the code separator.
  // Do not invent a clean Scan Item row category from padding.
  if (!value.trim()) return null;
  return canonicalizeScanItemRowCategory(value);
}
