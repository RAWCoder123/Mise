/**
 * Supplier-reliability domain supplierName display-name helpers (MISE-005OZ).
 *
 * Pins domain-layer `buildSupplierReliabilitySummary` presentation
 * `order.supplier_name` outside the Orders application graph so Node tests can
 * exercise inventing proofs without loading Supabase or demo storage. Supplier
 * presentation names previously Unicode-trimmed through
 * `order.supplier_name.trim()`, so em-space padding invented a clean display
 * name before the reliability entry returned it
 * (`'\u2003Pantry Co.\u2003'.trim() === 'Pantry Co.'`).
 *
 * Presentation display names follow the MISE-005B / #410 /
 * `private.normalize_supplier_display_name` contract mirrored by
 * suppliers-settings (#691), supplier display-name validation (#692),
 * restaurant-tasks relatedSupplierName (#821 / MISE-005OM), and order-automation
 * supplierName (#833 / MISE-005OY): fold NBSP to a plain space, collapse
 * C-locale `[[:space:]]`, then ASCII space trim. Unicode `String#trim` / `\s`
 * would collapse em-space and other non-C whitespace the hosted COLLATE "C"
 * path leaves alone, inventing a supplier presentation the server would not
 * treat as equal. Accents and case are preserved; discovery-key lowercasing
 * stays on the durable supplier-name path (#410), not this display prep.
 * Matching remains on `supplierId`.
 *
 * Complements open supplier-reliability supplier_id tip #825 / MISE-005OQ and
 * restaurant tip #780 / MISE-005MX without sharing their helper modules or
 * rewriting those paths. Intentionally does not change
 * `input.restaurantId.trim()` or `order.supplier_id` Map-key grouping. Those
 * remain on their existing contracts in this tip (open #780 / #825 tip them
 * separately).
 *
 * Supplier names are presentation text, not durable supplier IDs. Soft empty
 * after prep stays `""` so the reliability string contract matches prior
 * `.trim()` emptiness. Control / over-long rejection is available on the
 * normalize helper for callers that need a thrown contract; summary build uses
 * soft canonicalize only so it does not newly throw on presentation text.
 */

const C_WHITESPACE = /[ \t\n\v\f\r]+/g;
const SUPPLIER_NAME_MAX_CHARACTERS = 160;

/**
 * Canonical display text for supplier-reliability supplierName summary.
 * Folds NBSP, collapses C whitespace, ASCII-space trims. Does not
 * Unicode-trim, so em-space padding cannot invent equality with an
 * unpadded supplier display name.
 */
export function canonicalSupplierReliabilitySupplierName(value: string) {
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
 * Soft canonicalize for `buildSupplierReliabilitySummary`. Preserves soft
 * empty → `""` (prior `.trim()` contract) while refusing to invent a clean
 * display name via Unicode em-space trim. Does not throw.
 */
export function canonicalizeSupplierReliabilitySupplierName(value: string): string {
  const canonical = canonicalSupplierReliabilitySupplierName(value);
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()` emptied
  // those. Do not invent a one-character supplier presentation name.
  if (!value.trim()) return "";
  return canonical;
}

/**
 * Fail-closed supplierName normalize for callers that need a thrown contract.
 * Soft empty → `""`. Control-bearing / over-long / non-string tokens fail with
 * `Supplier reliability supplier name is invalid.` Summary build does not use
 * this path so it retains the prior never-throw presentation contract.
 */
export function normalizeCanonicalSupplierReliabilitySupplierName(
  value: unknown
): string {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value !== "string") {
    throw new Error("Supplier reliability supplier name is invalid.");
  }
  if (hasControlCharacters(value)) {
    throw new Error("Supplier reliability supplier name is invalid.");
  }
  const canonical = canonicalizeSupplierReliabilitySupplierName(value);
  if (!canonical) return "";
  if (canonical.length > SUPPLIER_NAME_MAX_CHARACTERS) {
    throw new Error("Supplier reliability supplier name is invalid.");
  }
  return canonical;
}

/**
 * Fail-closed supplierName require for focused inventing proofs. Preserves a
 * distinct message from restaurant / supplier-id tips:
 * `Supplier reliability supplier name is invalid.`
 */
export function requireCanonicalSupplierReliabilitySupplierName(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Supplier reliability supplier name is invalid.");
  }
  const canonical = normalizeCanonicalSupplierReliabilitySupplierName(value);
  if (!canonical) {
    throw new Error("Supplier reliability supplier name is invalid.");
  }
  return canonical;
}
