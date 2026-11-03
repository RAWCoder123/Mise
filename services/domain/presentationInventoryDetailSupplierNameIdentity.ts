/**
 * Inventory detail subtitle supplier_name identity helpers (MISE-005WR).
 *
 * Pins the Inventory detail Screen subtitle supplier-name interpolation that
 * previously always passed raw `item.supplier_name` into a composed subtitle
 * whenever an inventory item outlook existed:
 * `subtitle={item ? \`${item.supplier_name} · ${item.category}\` : ...}`.
 *
 * A Unicode-only-space supplier name (`"\u2003"`) is non-nullish and truthy as
 * an inventory-item field, so the detail subtitle still rendered a
 * blank-looking supplier identity before the category separator
 * (`"  · Produce"`). Empty string has the same blank-looking supplier path
 * (`" · Produce"`). Separately, Unicode `.trim()` on a padded supplier name
 * (`"\u2003Sysco\u2003".trim() === "Sysco"`) would invent a clean display
 * supplier identity if that gate Unicode-trimmed before interpolating into
 * the Inventory detail subtitle.
 *
 * Single-line supplier-name tips use ASCII end trim only and preserve NBSP
 * (no fold into plain space). Soft-null when Unicode trim would still strip
 * end padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded supplier name. Accents and case are preserved. Full C0/DEL
 * control rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **inventory.detail.supplierName.none** supplier-name
 * tokens only — the Inventory detail subtitle `item.supplier_name` that falls
 * through to that fallback when soft-null. Not Orders review
 * recommendation.supplier_name (#1051 / MISE-005WQ), not SupplierDraftCard
 * order.supplier_name (#1050 / MISE-005WP), not Orders detail title
 * supplier_name (#1016 / MISE-005VH), not miseDomain draft-order
 * supplier_name (#1034 / MISE-005VZ), not orderPresentation line labels
 * (#887 / MISE-005RA), not supplier draft line labels (#972 / MISE-005UH),
 * not daily-report `supplier.supplierName`, not Settings suppliers
 * `entry.supplierName`, not Inventory detail title `item.item_name`, and not
 * Inventory detail subtitle `item.category`. Soft empty / Unicode-padded /
 * control-bearing tokens soft-null so the live
 * `|| t("inventory.detail.supplierName.none")` branch owns the intentional
 * localized fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1051 / #1050 / #1034 / #1016 / #972 / #887 without
 * sharing those modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Inventory detail supplier name before it
 * is rendered into the detail subtitle.
 */
export function asciiTrimInventoryDetailSupplierName(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an Inventory detail supplier name under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeInventoryDetailSupplierName(
  value: string
): string | null {
  const trimmed = asciiTrimInventoryDetailSupplierName(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Inventory detail `item.supplier_name` display.
 * Preserves soft empty → null (intentional localized
 * inventory.detail.supplierName.none copy) while refusing to invent a clean
 * supplier name via Unicode em-space / NBSP trim. Does not throw;
 * Unicode-padded / unsafe / non-string tokens return null so the live
 * `|| t("inventory.detail.supplierName.none")` branch owns the fallback
 * without inventing a clean Inventory detail supplier name from padding, and
 * without letting non-nullish Unicode-only space or empty string render a
 * blank-looking supplier through the prior always-pass-name subtitle.
 */
export function normalizeInventoryDetailSupplierName(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered into the Inventory detail subtitle as a
  // blank-looking supplier identity before the category separator.
  // Do not invent a clean Inventory detail supplier name from padding.
  if (!value.trim()) return null;
  return canonicalizeInventoryDetailSupplierName(value);
}
