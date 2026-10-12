/**
 * Restaurant-tasks domain dependencyIds identity helpers (MISE-005OB).
 *
 * Pins domain-layer `normalizeCreateRestaurantTaskInput` /
 * `restaurantTaskFromPersistedRow` dependency id tokens outside the
 * repository graph so Node tests can exercise inventing proofs without
 * loading Supabase or demo storage. Dependency identities previously
 * Unicode-trimmed through shared `requiredText`, so NBSP/em-space padding
 * invented a valid durable dependency task identity before create RPC
 * arguments or hydrated task rows stored it
 * (`'\u00a0task-a\u00a0'.trim() === 'task-a'`).
 *
 * Complements open restaurant-tasks clientTaskId tip #808 / MISE-005NZ,
 * correlationId tip #809 / MISE-005OA, restaurant tip #739 / MISE-005LI,
 * and application taskId tip #762 / MISE-005MF without sharing their helper
 * modules or rewriting those paths. Intentionally does not change other
 * `requiredText` / `optionalText` surfaces (`restaurantId`, `clientTaskId`,
 * `correlationId`, `title`, `createdBy`, `assigneeUserId`,
 * `relatedInventoryItemId`, `relatedOrderId`, `relatedRecommendationId`,
 * `relatedSupplierName`, `sourceReference`, `taskId` on complete,
 * `completedBy`, or completion free-text). Those remain on their existing
 * Unicode-trim contracts in this tip.
 *
 * Dependency IDs are task identities (fixtures may use tokens such as
 * `task-a` / UUID-shaped hosted ids). Only ASCII end trim is pinned; case
 * is left unchanged so unknown casing still fails closed downstream. Max
 * length stays 200 to match the prior `requiredText(..., 200, ...)` cap.
 * Empty-after-trim remains hard-required (`Dependency id is invalid.`) so
 * missing dependency identity cannot soft-null into a create or hydrate.
 * Unlike `requiredText`, internal whitespace is not collapsed — collapsing
 * would invent a different durable dependency token.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized restaurant-task dependency identity
 * before it is stored as durable create/hydrate authority.
 */
export function asciiTrimRestaurantTasksDependencyToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a restaurant-tasks dependency id under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizeRestaurantTasksDependencyId(
  value: string
): string | null {
  const trimmed = asciiTrimRestaurantTasksDependencyToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 200) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed dependency id require for create normalization and row hydrate.
 * Preserves the existing `Dependency id is required.` / `Dependency id is
 * invalid.` error contracts from `requiredText` while refusing Unicode-padded
 * tokens that would invent a durable dependency identity.
 */
export function requireCanonicalRestaurantTasksDependencyId(
  value: unknown
): string {
  if (typeof value !== "string") {
    throw new Error("Dependency id is required.");
  }
  const canonical = canonicalizeRestaurantTasksDependencyId(value);
  if (canonical) return canonical;
  throw new Error("Dependency id is invalid.");
}
