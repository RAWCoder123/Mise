/**
 * Finding-decision outbox storage key-prefix identity helpers (MISE-005ND).
 *
 * Pins repository-layer `findingDecisionOutboxRepository.ts` `storageKey`
 * `keyPrefix` outside the AsyncStorage / device graph so Node tests can
 * exercise inventing proofs without loading Expo persistence. Complements open
 * finding-decision outbox entry-id tip #785 without sharing that helper module
 * or rewriting inventory outbox key-prefix paths (#784 / sibling inventory
 * repository emptiness check).
 *
 * Intentionally does not change restaurant-id validation on the same
 * `storageKey` path — that remains the existing ASCII class regex gate.
 *
 * Key prefixes are not UUID-shaped (default
 * `mise.finding-decision-outbox.v1`; tests may inject alternate partitions).
 * Only ASCII end trim is pinned; case is left unchanged to preserve the
 * existing exact storage-key contract. Max length 128 matches sibling
 * object-identity tips.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized finding-decision-outbox storage partition
 * before list / save / persist.
 */
export function asciiTrimFindingDecisionOutboxKeyPrefixToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a finding-decision-outbox storage key prefix under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizeFindingDecisionOutboxKeyPrefix(
  value: string
): string | null {
  const trimmed = asciiTrimFindingDecisionOutboxKeyPrefixToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 128) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed key-prefix require used by `storageKey`.
 * Preserves the existing `missing_finding_decision_outbox_key_prefix` error
 * contract.
 */
export function requireCanonicalFindingDecisionOutboxKeyPrefix(
  value: unknown
): string {
  if (typeof value !== "string") {
    throw new Error("missing_finding_decision_outbox_key_prefix");
  }
  const text = canonicalizeFindingDecisionOutboxKeyPrefix(value);
  if (!text) {
    throw new Error("missing_finding_decision_outbox_key_prefix");
  }
  return text;
}
