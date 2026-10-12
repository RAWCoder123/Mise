/**
 * Restaurant-tasks domain relatedSupplierName display-name helpers
 * (MISE-005OM).
 *
 * Pins domain-layer `normalizeCreateRestaurantTaskInput` /
 * `restaurantTaskFromPersistedRow` `relatedSupplierName` outside the
 * repository graph so Node tests can exercise inventing proofs without
 * loading Supabase or demo storage. Related supplier names previously
 * Unicode-trimmed through shared `optionalText`, so em-space padding
 * invented a clean display name before create RPC arguments or hydrated
 * task rows stored it
 * (`'\u2003Regional Protein Co\u2003'.trim() === 'Regional Protein Co'`).
 *
 * Presentation display names follow the MISE-005B / #410 /
 * `private.normalize_supplier_display_name` contract mirrored by
 * suppliers-settings (#691) and supplier display-name validation (#692):
 * fold NBSP to a plain space, collapse C-locale `[[:space:]]`, then ASCII
 * space trim. Unicode `String#trim` / `\s` would collapse em-space and
 * other non-C whitespace the hosted COLLATE "C" path leaves alone,
 * inventing a related-supplier presentation the server would not treat as
 * equal. Accents and case are preserved; discovery-key lowercasing stays
 * on the durable supplier-name path (#410), not this display prep.
 *
 * Complements open restaurant-tasks clientTaskId tip #808 / MISE-005NZ,
 * correlationId tip #809 / MISE-005OA, dependencyIds tip #810 / MISE-005OB,
 * assigneeUserId tip #811 / MISE-005OC, relatedInventoryItemId tip #812 /
 * MISE-005OD, relatedOrderId tip #813 / MISE-005OE, relatedRecommendationId
 * tip #814 / MISE-005OF, createdBy tip #815 / MISE-005OG, completedBy tip
 * #816 / MISE-005OH, locationId tip #817 / MISE-005OI, sourceReference tip
 * #820 / MISE-005OL, restaurant tip #739 / MISE-005LI, and application
 * taskId tip #762 / MISE-005MF without sharing their helper modules or
 * rewriting those paths. Intentionally does not change other
 * `requiredText` / `optionalText` surfaces (`restaurantId`, `clientTaskId`,
 * `correlationId`, `dependencyIds`, `assigneeUserId`, `title`, `createdBy`,
 * `relatedInventoryItemId`, `relatedOrderId`, `relatedRecommendationId`,
 * `sourceReference`, `taskId` on complete, `completedBy`, `locationId`, or
 * completion free-text). Those remain on their existing Unicode-trim
 * contracts in this tip.
 *
 * Related supplier names are presentation text, not durable supplier IDs.
 * Max length stays 200 to match the prior `optionalText(..., 200, ...)`
 * cap and the hosted `related_supplier_name` bound. Empty-after-prep
 * remains soft-null so a task without a related supplier stays ordinary
 * and fully recordable.
 */

const C_WHITESPACE = /[ \t\n\v\f\r]+/g;

/**
 * Canonical display text for restaurant-tasks relatedSupplierName create /
 * hydrate. Folds NBSP, collapses C whitespace, ASCII-space trims. Does not
 * Unicode-trim, so em-space padding cannot invent equality with an
 * unpadded supplier display name.
 */
export function canonicalRestaurantTasksRelatedSupplierName(value: string) {
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
 * Fail-closed relatedSupplierName normalize for create normalization and
 * row hydrate. Preserves soft empty → null (`optionalText` contract) while
 * refusing control-bearing / over-long / non-string tokens, and refusing to
 * invent a clean display name via Unicode em-space trim. Null/undefined/""
 * remain null (optional related supplier). Error contract:
 * `Related supplier is invalid.`
 */
export function normalizeCanonicalRestaurantTasksRelatedSupplierName(
  value: unknown
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    throw new Error("Related supplier is invalid.");
  }
  if (hasControlCharacters(value)) {
    throw new Error("Related supplier is invalid.");
  }
  const canonical = canonicalRestaurantTasksRelatedSupplierName(value);
  if (!canonical) return null;
  // Preserve soft empty for Unicode-only space (em-space alone): optionalText
  // treated that as null; do not invent a one-character related-supplier name.
  if (!value.trim()) return null;
  if (canonical.length > 200) {
    throw new Error("Related supplier is invalid.");
  }
  return canonical;
}
