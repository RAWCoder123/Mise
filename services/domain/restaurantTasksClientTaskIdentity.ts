/**
 * Restaurant-tasks domain clientTaskId identity helpers (MISE-005NZ).
 *
 * Pins domain-layer `normalizeCreateRestaurantTaskInput` /
 * `restaurantTaskFromPersistedRow` `clientTaskId` outside the repository
 * graph so Node tests can exercise inventing proofs without loading Supabase
 * or demo storage. Client task identity previously Unicode-trimmed through
 * shared `requiredText`, so NBSP/em-space padding invented a valid durable
 * client-task idempotency identity before create RPC arguments or hydrated
 * task rows stored it.
 *
 * Complements open restaurant-tasks restaurant tip #739 / MISE-005LI and
 * application taskId tip #762 / MISE-005MF without sharing their helper
 * modules or rewriting those paths. Intentionally does not change other
 * `requiredText` / `optionalText` surfaces (`restaurantId`, `title`,
 * `correlationId`, `createdBy`, `dependencyIds`, `assigneeUserId`,
 * `relatedInventoryItemId`, `relatedOrderId`, `relatedRecommendationId`,
 * `relatedSupplierName`, `sourceReference`, `taskId` on complete, or
 * completion free-text). Those remain on their existing Unicode-trim
 * contracts in this tip.
 *
 * Client task IDs are not UUID-shaped on every path (demo tokens such as
 * `client-task-1` / `demo-shared-count`). Only ASCII end trim is pinned;
 * case is left unchanged so unknown casing still fails closed downstream.
 * Max length stays 200 to match the prior `requiredText(..., 200, ...)` cap.
 * Empty-after-trim remains hard-required (`Client task id is invalid.`) so
 * missing client-task identity cannot soft-null into a create or hydrate.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized restaurant-task client-task identity
 * before it is stored as durable create/hydrate authority.
 */
export function asciiTrimRestaurantTasksClientTaskToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a restaurant-tasks clientTaskId under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizeRestaurantTasksClientTaskId(
  value: string
): string | null {
  const trimmed = asciiTrimRestaurantTasksClientTaskToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 200) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed clientTaskId require for create normalization and row hydrate.
 * Preserves the existing `Client task id is required.` / `Client task id is
 * invalid.` error contracts from `requiredText` while refusing Unicode-padded
 * tokens that would invent a durable client-task identity.
 */
export function requireCanonicalRestaurantTasksClientTaskId(
  value: unknown
): string {
  if (typeof value !== "string") {
    throw new Error("Client task id is required.");
  }
  const canonical = canonicalizeRestaurantTasksClientTaskId(value);
  if (canonical) return canonical;
  throw new Error("Client task id is invalid.");
}
