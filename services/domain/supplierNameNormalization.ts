import { foldPurchaseLineAccents } from "./purchaseLines";

/**
 * MISE-005B. Matches `private.normalize_supplier_display_name`: fold NBSP to a
 * plain space, collapse C-locale whitespace, trim. Preserves accents and case.
 * `toLowerCase` / `\s` are Unicode-aware and would not match the server.
 */
const C_WHITESPACE = /[ \t\n\v\f\r]+/g;

export function normalizeSupplierDisplayName(raw: string): string | null {
  const canonical = raw
    .replace(/\u00a0/g, " ")
    .replace(C_WHITESPACE, " ")
    .replace(/^ +/, "")
    .replace(/ +$/, "");
  return canonical.length === 0 ? null : canonical;
}

/**
 * MISE-005B. Matches `private.normalize_supplier_name`: accent-fold the
 * display-canonical form, then lowercase A-Z only (same as `lower(... COLLATE "C")`).
 * Discovery key only — never purchasing authority.
 */
export function normalizeSupplierName(raw: string): string | null {
  const displayName = normalizeSupplierDisplayName(raw);
  if (displayName === null) return null;
  return foldPurchaseLineAccents(displayName).replace(/[A-Z]/g, (character) =>
    character.toLowerCase()
  );
}
