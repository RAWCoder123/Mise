/**
 * Restaurant-tasks domain assigneeUserId identity helpers (MISE-005OC).
 *
 * Pins domain-layer `normalizeCreateRestaurantTaskInput` /
 * `restaurantTaskFromPersistedRow` `assigneeUserId` outside the repository
 * graph so Node tests can exercise inventing proofs without loading Supabase
 * or demo storage. Assignee identity previously Unicode-trimmed through
 * shared `optionalText`, so NBSP/em-space padding invented a valid durable
 * assignee user identity before create RPC arguments or hydrated task rows
 * stored it (`'\u00a0staff-1\u00a0'.trim() === 'staff-1'`).
 *
 * Complements open restaurant-tasks clientTaskId tip #808 / MISE-005NZ,
 * correlationId tip #809 / MISE-005OA, dependencyIds tip #810 / MISE-005OB,
 * restaurant tip #739 / MISE-005LI, and application taskId tip #762 /
 * MISE-005MF without sharing their helper modules or rewriting those paths.
 * Intentionally does not change other `requiredText` / `optionalText`
 * surfaces (`restaurantId`, `clientTaskId`, `correlationId`, `dependencyIds`,
 * `title`, `createdBy`, `relatedInventoryItemId`, `relatedOrderId`,
 * `relatedRecommendationId`, `relatedSupplierName`, `sourceReference`,
 * `taskId` on complete, `completedBy`, `locationId`, or completion
 * free-text). Those remain on their existing Unicode-trim contracts in this
 * tip.
 *
 * Assignee user IDs are UUID-shaped on the hosted path but may be other
 * durable tokens in fixtures (for example `staff-1`). Only ASCII end trim is
 * pinned; case is left unchanged so unknown casing still fails closed
 * downstream. Max length stays 200 to match the prior
 * `optionalText(..., 200, ...)` cap. Empty-after-trim remains soft-null so an
 * unassigned task stays ordinary and fully recordable.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized restaurant-task assignee identity
 * before it is stored as durable create/hydrate authority.
 */
export function asciiTrimRestaurantTasksAssigneeToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a restaurant-tasks assigneeUserId under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizeRestaurantTasksAssigneeUserId(
  value: string
): string | null {
  const trimmed = asciiTrimRestaurantTasksAssigneeToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 200) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed assigneeUserId normalize for create normalization and row hydrate.
 * Preserves soft empty → null (`optionalText` contract) while refusing
 * Unicode-padded tokens that would invent a durable assignee identity.
 * Null/undefined/"" remain null (optional assignment).
 * Error contract: `Task assignee is invalid.`
 */
export function normalizeCanonicalRestaurantTasksAssigneeUserId(
  value: unknown
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    throw new Error("Task assignee is invalid.");
  }
  const canonical = canonicalizeRestaurantTasksAssigneeUserId(value);
  if (canonical) return canonical;
  // Preserve soft empty (ASCII whitespace or Unicode-only space) → null.
  if (!value.trim()) return null;
  throw new Error("Task assignee is invalid.");
}
