/**
 * Restaurant-tasks domain sourceReference identity helpers (MISE-005OL).
 *
 * Pins domain-layer `normalizeCreateRestaurantTaskInput` /
 * `restaurantTaskFromPersistedRow` `sourceReference` outside the repository
 * graph so Node tests can exercise inventing proofs without loading Supabase
 * or demo storage. Task source references previously Unicode-trimmed through
 * shared `optionalText`, so NBSP/em-space padding invented a valid durable
 * source-reference key before create RPC arguments or hydrated task rows
 * stored it (`'\u00a0inventory-risk:item-1\u00a0'.trim() === 'inventory-risk:item-1'`).
 *
 * Complements open restaurant-tasks clientTaskId tip #808 / MISE-005NZ,
 * correlationId tip #809 / MISE-005OA, dependencyIds tip #810 / MISE-005OB,
 * assigneeUserId tip #811 / MISE-005OC, relatedInventoryItemId tip #812 /
 * MISE-005OD, relatedOrderId tip #813 / MISE-005OE, relatedRecommendationId
 * tip #814 / MISE-005OF, createdBy tip #815 / MISE-005OG, completedBy tip
 * #816 / MISE-005OH, locationId tip #817 / MISE-005OI, restaurant tip #739 /
 * MISE-005LI, and application taskId tip #762 / MISE-005MF without sharing
 * their helper modules or rewriting those paths. Intentionally does not change
 * other `requiredText` / `optionalText` surfaces (`restaurantId`, `clientTaskId`,
 * `correlationId`, `dependencyIds`, `assigneeUserId`, `title`, `createdBy`,
 * `relatedInventoryItemId`, `relatedOrderId`, `relatedRecommendationId`,
 * `relatedSupplierName`, `taskId` on complete, `completedBy`, `locationId`, or
 * completion free-text). Those remain on their existing Unicode-trim contracts
 * in this tip.
 *
 * Source references are structured correlation keys (for example
 * `inventory-risk:item-1`), not free-form prose. Only ASCII end trim is pinned;
 * case is left unchanged so unknown casing still fails closed downstream. Max
 * length stays 240 to match the prior `optionalText(..., 240, ...)` cap.
 * Empty-after-trim remains soft-null so a task without a source reference stays
 * ordinary and fully recordable.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized restaurant-task source reference key
 * before it is stored as durable create/hydrate authority.
 */
export function asciiTrimRestaurantTasksSourceReferenceToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a restaurant-tasks sourceReference under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizeRestaurantTasksSourceReference(
  value: string
): string | null {
  const trimmed = asciiTrimRestaurantTasksSourceReferenceToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 240) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed sourceReference normalize for create normalization and row
 * hydrate. Preserves soft empty → null (`optionalText` contract) while
 * refusing Unicode-padded tokens that would invent a durable source-reference
 * key. Null/undefined/"" remain null (optional source reference).
 * Error contract: `Task source reference is invalid.`
 */
export function normalizeCanonicalRestaurantTasksSourceReference(
  value: unknown
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    throw new Error("Task source reference is invalid.");
  }
  const canonical = canonicalizeRestaurantTasksSourceReference(value);
  if (canonical) return canonical;
  // Preserve soft empty (ASCII whitespace or Unicode-only space) → null.
  if (!value.trim()) return null;
  throw new Error("Task source reference is invalid.");
}
