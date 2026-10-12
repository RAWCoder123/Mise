/**
 * Restaurant-tasks domain correlationId identity helpers (MISE-005OA).
 *
 * Pins domain-layer `restaurantTaskFromPersistedRow` `correlationId` outside
 * the repository graph so Node tests can exercise inventing proofs without
 * loading Supabase or demo storage. Task correlation identity previously
 * Unicode-trimmed through shared `requiredText`, so NBSP/em-space padding
 * invented a valid durable correlation identity before hydrated task rows
 * stored it. Hosted `correlation_id` is UUID-shaped; fixtures may use other
 * durable tokens such as `correlation-1`.
 *
 * Complements open restaurant-tasks clientTaskId tip #808 / MISE-005NZ,
 * restaurant tip #739 / MISE-005LI, and application taskId tip #762 /
 * MISE-005MF without sharing their helper modules or rewriting those paths.
 * Intentionally does not change other `requiredText` / `optionalText`
 * surfaces (`restaurantId`, `clientTaskId`, `title`, `createdBy`,
 * `dependencyIds`, `assigneeUserId`, `relatedInventoryItemId`,
 * `relatedOrderId`, `relatedRecommendationId`, `relatedSupplierName`,
 * `sourceReference`, `taskId` on complete, `completedBy`, or completion
 * free-text). Those remain on their existing Unicode-trim contracts in this
 * tip.
 *
 * Only ASCII end trim is pinned; case is left unchanged so unknown casing
 * still fails closed downstream. Max length stays 200 to match the prior
 * `requiredText(..., 200, ...)` cap. Empty-after-trim remains hard-required
 * (`Task correlation id is invalid.`) so missing correlation identity cannot
 * soft-null into a hydrated task row. Unlike `requiredText`, internal
 * whitespace is not collapsed — collapsing would invent a different durable
 * correlation token.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized restaurant-task correlation identity
 * before it is stored as durable hydrate authority.
 */
export function asciiTrimRestaurantTasksCorrelationToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a restaurant-tasks correlationId under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizeRestaurantTasksCorrelationId(
  value: string
): string | null {
  const trimmed = asciiTrimRestaurantTasksCorrelationToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 200) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed correlationId require for row hydrate.
 * Preserves the existing `Task correlation id is required.` /
 * `Task correlation id is invalid.` error contracts from `requiredText`
 * while refusing Unicode-padded tokens that would invent a durable
 * correlation identity.
 */
export function requireCanonicalRestaurantTasksCorrelationId(
  value: unknown
): string {
  if (typeof value !== "string") {
    throw new Error("Task correlation id is required.");
  }
  const canonical = canonicalizeRestaurantTasksCorrelationId(value);
  if (canonical) return canonical;
  throw new Error("Task correlation id is invalid.");
}
