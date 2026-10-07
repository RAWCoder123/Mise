/**
 * ASCII C-locale supplier display-name prep for Settings → Suppliers
 * (MISE-005JV).
 *
 * Mirrors `private.normalize_supplier_display_name` after MISE-005B (#410):
 * fold NBSP to a plain space, collapse C-locale `[[:space:]]`, then trim.
 * Unicode `String#trim` / `\s` would collapse em-space and other non-C
 * whitespace the hosted COLLATE "C" path leaves alone, inventing a
 * Save-disabled or rename candidate the server would not treat as equal.
 *
 * Preserves accents and case. Discovery-key lowercasing stays on the
 * durable `normalize_supplier_name` path (#410), not this display prep.
 * When #410 lands, prefer consolidating onto
 * `services/domain/supplierNameNormalization.ts`.
 */

const C_WHITESPACE = /[ \t\n\v\f\r]+/g;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;
const SUPPLIER_SETTINGS_NAME_MAX_CHARACTERS = 160;

/**
 * Canonical display text for suppliers-settings rename prep and
 * unchanged-draft comparison.
 */
export function canonicalSupplierSettingsDisplayName(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_WHITESPACE, " ")
    .replace(/^ +/, "")
    .replace(/ +$/, "");
}

export function supplierSettingsDisplayNamesMatch(left: string, right: string) {
  return (
    canonicalSupplierSettingsDisplayName(left) ===
    canonicalSupplierSettingsDisplayName(right)
  );
}

/** Local gate for suppliers-settings rename before the service validation layer. */
export function isValidSupplierSettingsDisplayName(value: string) {
  const canonical = canonicalSupplierSettingsDisplayName(value);
  return (
    canonical.length >= 1 &&
    canonical.length <= SUPPLIER_SETTINGS_NAME_MAX_CHARACTERS &&
    !CONTROL_CHARACTER_PATTERN.test(value)
  );
}
