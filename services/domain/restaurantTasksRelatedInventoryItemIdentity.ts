/**
 * Restaurant-tasks domain relatedInventoryItemId identity helpers (MISE-005OD).
 *
 * Pins domain-layer `normalizeCreateRestaurantTaskInput` /
 * `restaurantTaskFromPersistedRow` `relatedInventoryItemId` outside the
 * repository graph so Node tests can exercise inventing proofs without loading
 * Supabase or demo storage. Related inventory item identity previously
 * Unicode-trimmed through shared `optionalText`, so NBSP/em-space padding
 * invented a valid durable inventory item identity before create RPC arguments
 * or hydrated task rows stored it (`'\u00a0item-1\u00a0'.trim() === 'item-1'`).
 *
 * Complements open restaurant-tasks clientTaskId tip #808 / MISE-005NZ,
 * correlationId tip #809 / MISE-005OA, dependencyIds tip #810 / MISE-005OB,
 * assigneeUserId tip #811 / MISE-005OC, restaurant tip #739 / MISE-005LI, and
 * application taskId tip #762 / MISE-005MF without sharing their helper modules
 * or rewriting those paths. Intentionally does not change other `requiredText`
 * / `optionalText` surfaces (`restaurantId`, `clientTaskId`, `correlationId`,
 * `dependencyIds`, `assigneeUserId`, `title`, `createdBy`, `relatedOrderId`,
 * `relatedRecommendationId`, `relatedSupplierName`, `sourceReference`,
 * `taskId` on complete, `completedBy`, `locationId`, or completion free-text).
 * Those remain on their existing Unicode-trim contracts in this tip.
 *
 * Related inventory item IDs are UUID-shaped on the hosted path but may be
 * other durable tokens in fixtures (for example `item-1`). Only ASCII end trim
 * is pinned; case is left unchanged so unknown casing still fails closed
 * downstream. Max length stays 200 to match the prior
 * `optionalText(..., 200, ...)` cap. Empty-after-trim remains soft-null so an
 * unrelated task stays ordinary and fully recordable.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized restaurant-task related inventory item
 * identity before it is stored as durable create/hydrate authority.
 */
export function asciiTrimRestaurantTasksRelatedInventoryItemToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a restaurant-tasks relatedInventoryItemId under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizeRestaurantTasksRelatedInventoryItemId(
  value: string
): string | null {
  const trimmed = asciiTrimRestaurantTasksRelatedInventoryItemToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 200) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed relatedInventoryItemId normalize for create normalization and
 * row hydrate. Preserves soft empty → null (`optionalText` contract) while
 * refusing Unicode-padded tokens that would invent a durable inventory item
 * identity. Null/undefined/"" remain null (optional related item).
 * Error contract: `Related inventory item is invalid.`
 */
export function normalizeCanonicalRestaurantTasksRelatedInventoryItemId(
  value: unknown
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    throw new Error("Related inventory item is invalid.");
  }
  const canonical = canonicalizeRestaurantTasksRelatedInventoryItemId(value);
  if (canonical) return canonical;
  // Preserve soft empty (ASCII whitespace or Unicode-only space) → null.
  if (!value.trim()) return null;
  throw new Error("Related inventory item is invalid.");
}
