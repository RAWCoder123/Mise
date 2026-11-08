/**
 * Inventory detail subtitle category identity helpers (MISE-005AAD).
 *
 * Pins the Inventory detail Screen subtitle category interpolation that
 * previously always passed raw `item.category` into a composed subtitle
 * whenever an inventory item outlook existed:
 * `subtitle={item ? \`${item.supplier_name} · ${item.category}\` : ...}`.
 *
 * A Unicode-only-space category (`"\u2003"`) is non-nullish and truthy as an
 * inventory-item field, so the detail subtitle still rendered a blank-looking
 * category identity after the supplier separator (`"Sysco ·  "`). Empty string
 * has the same blank-looking category path (`"Sysco · "`). Separately, Unicode
 * `.trim()` on a padded category (`"\u2003Produce\u2003".trim() === "Produce"`)
 * would invent a clean display category identity if that gate Unicode-trimmed
 * before interpolating into the Inventory detail subtitle.
 *
 * Single-line category tips use ASCII end trim only and preserve NBSP (no fold
 * into plain space). Soft-null when Unicode trim would still strip end padding
 * (NBSP / em-space) so padding cannot invent equality with an unpadded
 * category. Accents and case are preserved. Full C0/DEL control rejection
 * applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **inventory.detail.category.none** category tokens
 * only — the Inventory detail subtitle `item.category` that falls through to
 * that fallback when soft-null. Not Inventory detail subtitle
 * `item.supplier_name` (#1052 / MISE-005WR), not Inventory detail title
 * `item.item_name` (#1017 / MISE-005VI), not Inventory hub item.item_name
 * (#1056 / MISE-005WV), not Inventory categoryIcon classify (#701 /
 * MISE-005KF), not setup POS itemName/category (#872 / MISE-005QL), not
 * Square catalog category (#952 / MISE-005TN), and not Scan Item row meta
 * category interpolations. Soft empty / Unicode-padded / control-bearing
 * tokens soft-null so the live `|| t("inventory.detail.category.none")`
 * branch owns the intentional localized fallback. Ordinary ASCII whitespace
 * still trims clean.
 *
 * Complements open #1052 / #1017 / #1056 / #701 / #872 / #952 without sharing
 * those modules or rewriting their call sites. #1052 explicitly left this
 * Inventory detail subtitle category path alone.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Inventory detail category before it is
 * rendered into the detail subtitle.
 */
export function asciiTrimInventoryDetailCategory(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an Inventory detail category under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeInventoryDetailCategory(
  value: string
): string | null {
  const trimmed = asciiTrimInventoryDetailCategory(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Inventory detail `item.category` display.
 * Preserves soft empty → null (intentional localized
 * inventory.detail.category.none copy) while refusing to invent a clean
 * category via Unicode em-space / NBSP trim. Does not throw;
 * Unicode-padded / unsafe / non-string tokens return null so the live
 * `|| t("inventory.detail.category.none")` branch owns the fallback
 * without inventing a clean Inventory detail category from padding, and
 * without letting non-nullish Unicode-only space or empty string render a
 * blank-looking category through the prior always-pass-name subtitle.
 */
export function normalizeInventoryDetailCategory(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered into the Inventory detail subtitle as a
  // blank-looking category identity after the supplier separator.
  // Do not invent a clean Inventory detail category from padding.
  if (!value.trim()) return null;
  return canonicalizeInventoryDetailCategory(value);
}
