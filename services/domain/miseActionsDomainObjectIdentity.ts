/**
 * Mise-actions domain object identity helpers (MISE-005MP).
 *
 * Pins domain-layer miseActions.ts `subjectId` / `idempotencyKey` / `actionId`
 * outside the repository graph so Node tests can exercise inventing proofs
 * without loading Supabase or demo storage. Complements open Mise-actions
 * application object tip #761 (`miseActionsObjectIdentity.ts` supplier-order /
 * supplier-send-action labels) without sharing that helper module or rewriting
 * application fetch/approve paths.
 *
 * Intentionally does not change `restaurantId.trim()` on
 * `miseActionIdempotencyKey` / `createPreparedAction` / `measureOutcome` /
 * `miseActionFromPersistedRow`. Those restaurant workspace paths remain on
 * Unicode trim in this tip. Intentionally does not rewrite operator free-text
 * fields (`approvedBy`, `error`, `rollbackReference`, `lesson`).
 *
 * Domain object IDs are not UUID-shaped on every path (demo tokens such as
 * `order_1` / `task:count-cabbage` / `action_1`). Only ASCII end trim is
 * pinned; case is left unchanged to preserve the existing contract.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized Mise-action domain object identity.
 */
export function asciiTrimMiseActionsDomainObjectToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Mise-actions domain object identity under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizeMiseActionsDomainObjectId(value: string): string | null {
  const trimmed = asciiTrimMiseActionsDomainObjectToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 128) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

export type MiseActionsDomainObjectLabel = "subject id" | "idempotency key" | "action id";

function missingMessage(label: MiseActionsDomainObjectLabel): string {
  switch (label) {
    case "subject id":
      return "Mise actions require a subject id.";
    case "idempotency key":
      return "Mise actions require an idempotency key.";
    case "action id":
      return "Outcomes require an action id.";
    default: {
      const _exhaustive: never = label;
      return _exhaustive;
    }
  }
}

/**
 * Fail-closed domain object require used by:
 * - `miseActionIdempotencyKey` (`subject id` → `Mise actions require a subject id.`)
 * - `createPreparedAction` (`idempotency key` → existing message)
 * - `measureOutcome` (`action id` → existing message)
 */
export function requireCanonicalMiseActionsDomainObjectId(
  value: unknown,
  label: MiseActionsDomainObjectLabel
): string {
  if (typeof value !== "string") {
    throw new Error(missingMessage(label));
  }
  const text = canonicalizeMiseActionsDomainObjectId(value);
  if (!text) {
    throw new Error(missingMessage(label));
  }
  return text;
}
