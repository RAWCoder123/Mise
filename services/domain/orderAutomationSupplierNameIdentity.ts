/**
 * Order-automation domain supplierName display-name helpers (MISE-005OY).
 *
 * Pins domain-layer `assessOrderAutomation` `supplierName` outside the
 * repository graph so Node tests can exercise inventing proofs without
 * loading Supabase or demo storage. Supplier presentation names previously
 * Unicode-trimmed through `input.supplierName.trim()`, so em-space padding
 * invented a clean display name before the assessment returned it
 * (`'\u2003Fresh Produce Co.\u2003'.trim() === 'Fresh Produce Co.'`).
 *
 * Presentation display names follow the MISE-005B / #410 /
 * `private.normalize_supplier_display_name` contract mirrored by
 * suppliers-settings (#691), supplier display-name validation (#692), and
 * restaurant-tasks relatedSupplierName (#821 / MISE-005OM): fold NBSP to a
 * plain space, collapse C-locale `[[:space:]]`, then ASCII space trim.
 * Unicode `String#trim` / `\s` would collapse em-space and other non-C
 * whitespace the hosted COLLATE "C" path leaves alone, inventing a supplier
 * presentation the server would not treat as equal. Accents and case are
 * preserved; discovery-key lowercasing stays on the durable supplier-name
 * path (#410), not this display prep. Matching remains on `supplierId`.
 *
 * Complements open order-automation supplierId tip #773 / MISE-005MQ and
 * restaurant workspace tip #779 / MISE-005MW without sharing their helper
 * modules or rewriting those paths. Intentionally does not change
 * `restaurantId.trim()` or `supplierId.trim()` on `assessOrderAutomation`.
 * Those remain on their existing Unicode-trim contracts in this tip (open
 * #773 / #779 tip them separately).
 *
 * Supplier names are presentation text, not durable supplier IDs. Soft empty
 * after prep stays `""` so the assessment string contract matches prior
 * `.trim()` emptiness. Control / over-long rejection is available on the
 * normalize helper for callers that need a thrown contract; assessment uses
 * soft canonicalize only so it does not newly throw on presentation text.
 */

const C_WHITESPACE = /[ \t\n\v\f\r]+/g;
const SUPPLIER_NAME_MAX_CHARACTERS = 160;

/**
 * Canonical display text for order-automation supplierName assessment.
 * Folds NBSP, collapses C whitespace, ASCII-space trims. Does not
 * Unicode-trim, so em-space padding cannot invent equality with an
 * unpadded supplier display name.
 */
export function canonicalOrderAutomationSupplierName(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_WHITESPACE, " ")
    .replace(/^ +/, "")
    .replace(/ +$/, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Soft canonicalize for `assessOrderAutomation`. Preserves soft empty → `""`
 * (prior `.trim()` contract) while refusing to invent a clean display name
 * via Unicode em-space trim. Does not throw.
 */
export function canonicalizeOrderAutomationSupplierName(value: string): string {
  const canonical = canonicalOrderAutomationSupplierName(value);
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()` emptied
  // those. Do not invent a one-character supplier presentation name.
  if (!value.trim()) return "";
  return canonical;
}

/**
 * Fail-closed supplierName normalize for callers that need a thrown contract.
 * Soft empty → `""`. Control-bearing / over-long / non-string tokens fail with
 * `Order automation supplier name is invalid.` Assessment does not use this
 * path so it retains the prior never-throw presentation contract.
 */
export function normalizeCanonicalOrderAutomationSupplierName(
  value: unknown
): string {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value !== "string") {
    throw new Error("Order automation supplier name is invalid.");
  }
  if (hasControlCharacters(value)) {
    throw new Error("Order automation supplier name is invalid.");
  }
  const canonical = canonicalizeOrderAutomationSupplierName(value);
  if (!canonical) return "";
  if (canonical.length > SUPPLIER_NAME_MAX_CHARACTERS) {
    throw new Error("Order automation supplier name is invalid.");
  }
  return canonical;
}

/**
 * Fail-closed supplierName require for focused inventing proofs. Preserves a
 * distinct message from restaurant / supplier-id tips:
 * `Order automation supplier name is invalid.`
 */
export function requireCanonicalOrderAutomationSupplierName(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Order automation supplier name is invalid.");
  }
  const canonical = normalizeCanonicalOrderAutomationSupplierName(value);
  if (!canonical) {
    throw new Error("Order automation supplier name is invalid.");
  }
  return canonical;
}
