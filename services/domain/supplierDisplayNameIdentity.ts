/**
 * ASCII C-locale supplier display-name prep for the service validation gate
 * and supplier-recipient directory (MISE-005JW).
 *
 * Mirrors `private.normalize_supplier_display_name` after MISE-005B (#410)
 * and the Settings UI prep in MISE-005JV (#691): fold NBSP to a plain space,
 * collapse C-locale `[[:space:]]`, then trim. Unicode `String#trim` / `\s`
 * would collapse em-space and other non-C whitespace the hosted COLLATE "C"
 * path leaves alone, inventing a canonical display name the server would not
 * treat as equal.
 *
 * Preserves accents and case. Discovery-key lowercasing stays on the durable
 * `normalize_supplier_name` path (#410), not this display prep. When #410
 * lands, prefer consolidating onto `services/domain/supplierNameNormalization.ts`
 * together with #691.
 */

const C_WHITESPACE = /[ \t\n\v\f\r]+/g;

/**
 * Canonical display text for supplier rename / create validation and
 * directory presentation.
 */
export function canonicalSupplierDisplayName(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_WHITESPACE, " ")
    .replace(/^ +/, "")
    .replace(/ +$/, "");
}
