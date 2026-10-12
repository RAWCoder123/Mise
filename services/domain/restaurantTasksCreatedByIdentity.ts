/**
 * Restaurant-tasks domain createdBy identity helpers (MISE-005OG).
 *
 * Pins domain-layer `restaurantTaskFromPersistedRow` `createdBy` outside the
 * repository graph so Node tests can exercise inventing proofs without loading
 * Supabase or demo storage. Task creator identity previously Unicode-trimmed
 * through shared `requiredText`, so NBSP/em-space padding invented a valid
 * durable creator identity before hydrated task rows stored it
 * (`'\u00a0manager-1\u00a0'.trim() === 'manager-1'`). Hosted `created_by` is
 * UUID-shaped; fixtures may use other durable tokens such as `manager-1`.
 *
 * Complements open restaurant-tasks clientTaskId tip #808 / MISE-005NZ,
 * correlationId tip #809 / MISE-005OA, dependencyIds tip #810 / MISE-005OB,
 * assigneeUserId tip #811 / MISE-005OC, relatedInventoryItemId tip #812 /
 * MISE-005OD, relatedOrderId tip #813 / MISE-005OE, relatedRecommendationId
 * tip #814 / MISE-005OF, restaurant tip #739 / MISE-005LI, and application
 * taskId tip #762 / MISE-005MF without sharing their helper modules or
 * rewriting those paths. Intentionally does not change other `requiredText` /
 * `optionalText` surfaces (`restaurantId`, `clientTaskId`, `correlationId`,
 * `dependencyIds`, `assigneeUserId`, `title`, `relatedInventoryItemId`,
 * `relatedOrderId`, `relatedRecommendationId`, `relatedSupplierName`,
 * `sourceReference`, `taskId` on complete, `completedBy`, `locationId`, or
 * completion free-text). Those remain on their existing Unicode-trim contracts
 * in this tip.
 *
 * Only ASCII end trim is pinned; case is left unchanged so unknown casing
 * still fails closed downstream. Max length stays 200 to match the prior
 * `requiredText(..., 200, ...)` cap. Empty-after-trim remains hard-required
 * (`Task creator is invalid.`) so missing creator identity cannot soft-null
 * into a hydrated task row. Unlike `requiredText`, internal whitespace is not
 * collapsed — collapsing would invent a different durable creator token.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized restaurant-task creator identity
 * before it is stored as durable hydrate authority.
 */
export function asciiTrimRestaurantTasksCreatedByToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a restaurant-tasks createdBy under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizeRestaurantTasksCreatedBy(
  value: string
): string | null {
  const trimmed = asciiTrimRestaurantTasksCreatedByToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 200) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed createdBy require for row hydrate.
 * Preserves the existing `Task creator is required.` /
 * `Task creator is invalid.` error contracts from `requiredText`
 * while refusing Unicode-padded tokens that would invent a durable
 * creator identity.
 */
export function requireCanonicalRestaurantTasksCreatedBy(
  value: unknown
): string {
  if (typeof value !== "string") {
    throw new Error("Task creator is required.");
  }
  const canonical = canonicalizeRestaurantTasksCreatedBy(value);
  if (canonical) return canonical;
  throw new Error("Task creator is invalid.");
}
