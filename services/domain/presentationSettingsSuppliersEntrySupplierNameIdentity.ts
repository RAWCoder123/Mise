/**
 * Settings suppliers directory entry.supplierName identity helpers (MISE-005WT).
 *
 * Pins Settings → Suppliers directory supplier-name presentation that previously
 * always passed raw `entry.supplierName` into the supplierName Text and into
 * notice / accessibility interpolations:
 * `<Text style={styles.supplierName}>{entry.supplierName}</Text>`
 * and `copy.*Accessibility(entry.supplierName)` / `copy.*Body(entry.supplierName)`.
 *
 * A Unicode-only-space supplier name (`"\u2003"`) is non-nullish and truthy as
 * a directory entry field, so the Settings suppliers row still rendered a
 * blank-looking supplier identity with no intentional localized fallback.
 * Empty string has the same blank-looking supplier path. Separately,
 * Unicode `.trim()` on a padded supplier name
 * (`"\u2003Sysco\u2003".trim() === "Sysco"`) would invent a clean display
 * supplier identity if that gate Unicode-trimmed before interpolating into
 * the Settings suppliers directory chrome. Upstream directory prep
 * (`normalizeDisplayName` / open #692) is left alone on this tip.
 *
 * Single-line supplier-name tips use ASCII end trim only and preserve NBSP
 * (no fold into plain space). Soft-null when Unicode trim would still strip
 * end padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded supplier name. Accents and case are preserved. Full C0/DEL
 * control rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **settings.suppliers.supplierName.none** supplier-name
 * tokens only — the Settings suppliers directory `entry.supplierName` that
 * falls through to that fallback when soft-null. Not suppliers-settings rename
 * prep (#691 / MISE-005JV), not supplier display-name validation / directory
 * prep (#692 / MISE-005JW), not suppliers-settings draft-email (#690), not
 * suppliers-settings read-only email (#1032), not Inventory detail
 * item.supplier_name (#1052 / MISE-005WR), not Orders review
 * recommendation.supplier_name (#1051 / MISE-005WQ), not SupplierDraftCard
 * order.supplier_name (#1050 / MISE-005WP), not Orders detail title
 * supplier_name (#1016 / MISE-005VH), not miseDomain draft-order supplier_name
 * (#1034 / MISE-005VZ), and not daily-report supplier.supplierName
 * (#1053 / MISE-005WS). Soft empty / Unicode-padded / control-bearing tokens
 * soft-null so the live `|| t("settings.suppliers.supplierName.none")` branch
 * owns the intentional localized fallback. Ordinary ASCII whitespace still
 * trims clean.
 *
 * Complements open #1053 / #1052 / #1051 / #1050 / #1034 / #1032 / #1016 /
 * #692 / #691 / #690 without sharing those modules or rewriting their call
 * sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Settings suppliers entry supplier name
 * before it is rendered into the directory supplierName Text or a11y /
 * notice interpolations.
 */
export function asciiTrimSettingsSuppliersEntrySupplierName(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Settings suppliers directory supplier name under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeSettingsSuppliersEntrySupplierName(
  value: string
): string | null {
  const trimmed = asciiTrimSettingsSuppliersEntrySupplierName(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Settings suppliers directory `entry.supplierName` display.
 * Preserves soft empty → null (intentional localized
 * settings.suppliers.supplierName.none copy) while refusing to invent a clean
 * supplier name via Unicode em-space / NBSP trim. Does not throw;
 * Unicode-padded / unsafe / non-string tokens return null so the live
 * `|| t("settings.suppliers.supplierName.none")` branch owns the fallback
 * without inventing a clean Settings suppliers entry supplier name from
 * padding, and without letting non-nullish Unicode-only space or empty string
 * render a blank-looking supplier through the prior always-pass-name chrome.
 */
export function normalizeSettingsSuppliersEntrySupplierName(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered into the Settings suppliers directory as a
  // blank-looking supplier identity.
  // Do not invent a clean Settings suppliers entry supplier name from padding.
  if (!value.trim()) return null;
  return canonicalizeSettingsSuppliersEntrySupplierName(value);
}
