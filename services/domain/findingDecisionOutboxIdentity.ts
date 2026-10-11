/**
 * Finding-decision outbox entry-id identity helpers (MISE-005NC).
 *
 * Pins domain-layer findingDecisionOutbox.ts `createFindingDecisionOutboxEntry`
 * `id` outside the repository graph so Node tests can exercise inventing proofs
 * without loading AsyncStorage or device persistence. Complements open inventory
 * outbox tip #784 without sharing that helper module or rewriting inventory
 * outbox paths.
 *
 * Intentionally does not change decision-payload identity fields
 * (`clientEventId` / `idempotencyKey` / `restaurantId`) on the create path —
 * those remain owned by their own tipped or open stacks.
 *
 * Outbox entry IDs are not UUID-shaped on every path (tests may use tokens such
 * as `finding-outbox-1`; production uses `createId("finding_decision_outbox")` →
 * `finding_decision_outbox_<uuid>`). Only ASCII end trim is pinned; case is left
 * unchanged to preserve the existing exact-match / localeCompare contract.
 * Max length 128 matches sibling object-identity tips.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized finding-decision-outbox entry identity before
 * create / sort / persist.
 */
export function asciiTrimFindingDecisionOutboxIdToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a finding-decision-outbox entry id under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizeFindingDecisionOutboxId(value: string): string | null {
  const trimmed = asciiTrimFindingDecisionOutboxIdToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 128) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed outbox entry-id require used by `createFindingDecisionOutboxEntry`.
 * Preserves the existing `missing_finding_decision_outbox_id` error contract.
 */
export function requireCanonicalFindingDecisionOutboxId(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("missing_finding_decision_outbox_id");
  }
  const text = canonicalizeFindingDecisionOutboxId(value);
  if (!text) {
    throw new Error("missing_finding_decision_outbox_id");
  }
  return text;
}
