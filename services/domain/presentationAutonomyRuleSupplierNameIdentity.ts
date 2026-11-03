/**
 * Autonomy rule supplierName identity helpers (MISE-005XF).
 *
 * Pins Autonomy settings presentation that previously used
 * `rule.supplierName ?? "—"` for the Supplier scope ReadOnlyField.
 *
 * A Unicode-only-space supplier name (`"\u2003"`) is non-nullish under `??`,
 * so it bypassed the intentional none marker and rendered a blank-looking
 * supplier identity in the Supplier scope field. Empty string has the same
 * blank-looking supplier path. Separately, Unicode `.trim()` on a padded
 * supplier name (`"\u2003Sysco\u2003".trim() === "Sysco"`) would invent a
 * clean display supplier identity if that gate Unicode-trimmed before
 * rendering into the Autonomy Supplier scope chrome.
 *
 * Single-line supplier-name tips use ASCII end trim only and preserve NBSP
 * (no fold into plain space). Soft-null when Unicode trim would still strip
 * end padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded supplier name. Accents and case are preserved. Full C0/DEL
 * control rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **autonomy.field.supplier.none** supplier-name
 * tokens only — the Autonomy rule `supplierName` that falls through to that
 * fallback when soft-null (including the intentional null supplier-scope
 * case). Not Autonomy subtitle restaurant.name (#1043 / MISE-005WI), not
 * Settings suppliers entry.supplierName (#1054 / MISE-005WT), not
 * daily-report supplier.supplierName (#1053 / MISE-005WS), not Inventory
 * detail item.supplier_name (#1052 / MISE-005WR), not Orders review
 * recommendation.supplier_name (#1051 / MISE-005WQ), not SupplierDraftCard
 * order.supplier_name (#1050 / MISE-005WP), not Orders detail title
 * supplier_name (#1016 / MISE-005VH), and not restaurant_autonomy_rules
 * supplier_name cntrl CHECK (#613 / MISE-005GW). Soft empty /
 * Unicode-padded / control-bearing tokens soft-null so the live
 * `|| t("autonomy.field.supplier.none")` branch owns the intentional
 * localized fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1043 / #1054 / #1053 / #1052 / #1051 / #1050 / #1016 /
 * #613 without sharing those modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Autonomy rule supplier name before it
 * is rendered into the Supplier scope ReadOnlyField.
 */
export function asciiTrimAutonomyRuleSupplierName(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an Autonomy rule supplier name under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeAutonomyRuleSupplierName(
  value: string
): string | null {
  const trimmed = asciiTrimAutonomyRuleSupplierName(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Autonomy settings rule `supplierName` display.
 * Preserves soft empty → null (intentional localized
 * autonomy.field.supplier.none copy) while refusing to invent a clean
 * supplier name via Unicode em-space / NBSP trim. Does not throw;
 * Unicode-padded / unsafe / non-string tokens return null so the live
 * `|| t("autonomy.field.supplier.none")` branch owns the fallback
 * without inventing a clean Autonomy rule supplier name from padding, and
 * without letting non-nullish Unicode-only space or empty string bypass
 * the prior `?? "—"` none marker through blank-looking Supplier scope chrome.
 */
export function normalizeAutonomyRuleSupplierName(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered into the Supplier scope field as a
  // blank-looking supplier identity instead of the intentional none marker.
  // Do not invent a clean Autonomy rule supplier name from padding.
  if (!value.trim()) return null;
  return canonicalizeAutonomyRuleSupplierName(value);
}
