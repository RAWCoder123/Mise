/**
 * Restaurant-memory domain scope / source identity helpers (MISE-005PG).
 *
 * Pins domain-layer `createMemory` / `restaurantMemoryFromPersistedRow`
 * `scope` and `source` outside the repository graph so Node tests can
 * exercise inventing proofs without loading Supabase or demo storage. Memory
 * scope and source previously Unicode-trimmed on create
 * (`(input.scope ?? "restaurant").trim() || "restaurant"` and the matching
 * source default), so NBSP/em-space padding invented a clean durable
 * vocabulary / provenance key before the memory row stored it
 * (`'\u2003restaurant\u2003'.trim() === 'restaurant'` and
 * `'\u2003mise_learning\u2003'.trim() === 'mise_learning'`).
 *
 * Complements open restaurant-memory statement tip #830 / MISE-005OV,
 * learning-signal classify tip #699 / MISE-005KD, and SQL scope/source cntrl
 * pins #511 / #566 without sharing their helper modules or rewriting those
 * paths. Intentionally does not change `requireRestaurantId`,
 * `boundedStatement` / statement free-text, learning-signal `label` /
 * `detail` filters, hydrate `correction` / `correctionNote`, or outcome
 * lesson selection. Those remain on their existing contracts in this tip
 * (statement inventing stays with #830).
 *
 * Scope and source are structured single-line identity keys (scope is a
 * fixed vocabulary on the hosted table; source is a bounded provenance
 * string), not free-form prose. Only ASCII end trim is pinned; case is left
 * unchanged so unknown casing still fails closed downstream. Soft empty
 * (ASCII whitespace or Unicode-only space) stays soft-null so create can
 * fall through to the prior defaults (`restaurant` / `mise_learning`)
 * without inventing those defaults from a padded real token. Unicode-padded
 * non-empty tokens fail closed rather than inventing equality with the
 * unpadded key.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized restaurant-memory scope or source key
 * before it is stored as durable create/hydrate authority.
 */
export function asciiTrimRestaurantMemoryScopeSourceToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a restaurant-memory scope / source token under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeRestaurantMemoryScopeSourceToken(
  value: string
): string | null {
  const trimmed = asciiTrimRestaurantMemoryScopeSourceToken(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed scope normalize for create normalization and row hydrate.
 * Preserves soft empty → null (prior `.trim() || default` emptiness) while
 * refusing Unicode-padded tokens that would invent a durable scope key.
 * Null/undefined/"" remain null so create can apply the `restaurant` default.
 * Error contract: `Restaurant memory scope is invalid.`
 */
export function normalizeCanonicalRestaurantMemoryScope(
  value: unknown
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    throw new Error("Restaurant memory scope is invalid.");
  }
  const canonical = canonicalizeRestaurantMemoryScopeSourceToken(value);
  if (canonical) return canonical;
  // Preserve soft empty (ASCII whitespace or Unicode-only space) → null.
  if (!value.trim()) return null;
  throw new Error("Restaurant memory scope is invalid.");
}

/**
 * Fail-closed source normalize for create normalization and row hydrate.
 * Preserves soft empty → null (prior `.trim() || default` emptiness) while
 * refusing Unicode-padded tokens that would invent a durable source key.
 * Null/undefined/"" remain null so create can apply the `mise_learning`
 * default. Error contract: `Restaurant memory source is invalid.`
 */
export function normalizeCanonicalRestaurantMemorySource(
  value: unknown
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    throw new Error("Restaurant memory source is invalid.");
  }
  const canonical = canonicalizeRestaurantMemoryScopeSourceToken(value);
  if (canonical) return canonical;
  // Preserve soft empty (ASCII whitespace or Unicode-only space) → null.
  if (!value.trim()) return null;
  throw new Error("Restaurant memory source is invalid.");
}

/**
 * Fail-closed scope require for hydrate proofs where a persisted scope must
 * already be present. Soft empty fails closed rather than inventing the
 * create-time `restaurant` default on read.
 */
export function requireCanonicalRestaurantMemoryScope(value: unknown): string {
  const canonical = normalizeCanonicalRestaurantMemoryScope(value);
  if (!canonical) {
    throw new Error("Restaurant memory scope is invalid.");
  }
  return canonical;
}

/**
 * Fail-closed source require for hydrate proofs where a persisted source must
 * already be present. Soft empty fails closed rather than inventing the
 * create-time `mise_learning` default on read.
 */
export function requireCanonicalRestaurantMemorySource(value: unknown): string {
  const canonical = normalizeCanonicalRestaurantMemorySource(value);
  if (!canonical) {
    throw new Error("Restaurant memory source is invalid.");
  }
  return canonical;
}
