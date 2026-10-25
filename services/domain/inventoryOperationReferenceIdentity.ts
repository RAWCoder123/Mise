/**
 * Inventory-operation sourceReference / reasonCode identity helpers (MISE-005PU).
 *
 * Pins miseValidation `requireInventoryOperation` evidence-field prep outside
 * the repository graph so Node tests can exercise inventing proofs without
 * loading Supabase or AsyncStorage. Operator inventory `sourceReference` and
 * `reasonCode` previously Unicode-trimmed (`.trim()` only via
 * `optionalBoundedText` inside `requireInventoryOperation`), so NBSP/em-space
 * padding invented a clean durable ledger evidence token before the event was
 * stored (`'\u2003invoice-42\u2003'.trim() === 'invoice-42'` and
 * `'\u2003delivery\u2003'.trim() === 'delivery'`).
 *
 * These are single-line ledger evidence keys (bounded reference / reason
 * codes), not free-form multiline prose. Only ASCII end trim is pinned; case
 * and accents are left unchanged so presentation stays operator-faithful.
 * Soft empty (ASCII whitespace or Unicode-only space) stays soft-null so an
 * operation without a reference or reason stays ordinary. Unicode-padded
 * non-empty tokens fail closed rather than inventing equality with the
 * unpadded key.
 *
 * Complements open inventory-operation note tip #854 / MISE-005PT (multiline
 * free-text) without sharing that module or rewriting the note path that
 * still Unicode-trims on main via `optionalBoundedText`. Count-line /
 * count-session / supplier operator_note / restaurant-memory scope-source
 * tips remain on their existing contracts in this tip.
 *
 * Max lengths stay 200 (reference) and 80 (reason) to match the prior
 * `optionalBoundedText` bounds. Live require preserves the prior messages
 * (`Enter a valid reference.` / `Enter a shorter reference.` /
 * `Enter a valid reason.` / `Enter a shorter reason.`).
 */

import {
  INVENTORY_OPERATION_REASON_CODE_MAX_CHARACTERS,
  INVENTORY_OPERATION_SOURCE_REFERENCE_MAX_CHARACTERS
} from "./securityLimits";

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized inventory-operation reference or reason
 * code before it is stored as durable ledger evidence.
 */
export function asciiTrimInventoryOperationReferenceToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an inventory-operation sourceReference / reasonCode token
 * under ASCII C. Returns null when empty after ASCII trim, still
 * Unicode-padded, or containing ASCII controls.
 */
export function canonicalizeInventoryOperationReferenceToken(
  value: string
): string | null {
  const trimmed = asciiTrimInventoryOperationReferenceToken(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed sourceReference normalize for `requireInventoryOperation` and
 * inventing proofs. Soft empty → `null`. Unsafe-control / Unicode-padded /
 * non-string tokens fail with `Enter a valid reference.`. Over-long fails
 * with `Enter a shorter reference.`.
 *
 * Error contracts:
 * - non-string / unsafe control / Unicode-padded → `Enter a valid reference.`
 * - over-long (>200 after prep) → `Enter a shorter reference.`
 */
export function normalizeCanonicalInventoryOperationSourceReference(
  value: unknown
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    throw new Error("Enter a valid reference.");
  }
  const canonical = canonicalizeInventoryOperationReferenceToken(value);
  if (canonical) {
    if (canonical.length > INVENTORY_OPERATION_SOURCE_REFERENCE_MAX_CHARACTERS) {
      throw new Error("Enter a shorter reference.");
    }
    return canonical;
  }
  // Soft empty for ASCII whitespace or Unicode-only space: prior `.trim()`
  // emptied those. Do not invent a reference from padding.
  if (!value.trim()) return null;
  throw new Error("Enter a valid reference.");
}

/**
 * Fail-closed reasonCode normalize for `requireInventoryOperation` and
 * inventing proofs. Soft empty → `null`. Unsafe-control / Unicode-padded /
 * non-string tokens fail with `Enter a valid reason.`. Over-long fails with
 * `Enter a shorter reason.`.
 *
 * Error contracts:
 * - non-string / unsafe control / Unicode-padded → `Enter a valid reason.`
 * - over-long (>80 after prep) → `Enter a shorter reason.`
 */
export function normalizeCanonicalInventoryOperationReasonCode(
  value: unknown
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    throw new Error("Enter a valid reason.");
  }
  const canonical = canonicalizeInventoryOperationReferenceToken(value);
  if (canonical) {
    if (canonical.length > INVENTORY_OPERATION_REASON_CODE_MAX_CHARACTERS) {
      throw new Error("Enter a shorter reason.");
    }
    return canonical;
  }
  // Soft empty for ASCII whitespace or Unicode-only space: prior `.trim()`
  // emptied those. Do not invent a reason code from padding.
  if (!value.trim()) return null;
  throw new Error("Enter a valid reason.");
}

/**
 * Fail-closed sourceReference require for focused inventing proofs where a
 * present reference must already be canonical. Soft empty fails closed
 * rather than inventing a clean reference from padding.
 */
export function requireCanonicalInventoryOperationSourceReference(
  value: unknown
): string {
  const canonical = normalizeCanonicalInventoryOperationSourceReference(value);
  if (!canonical) {
    throw new Error("Enter a valid reference.");
  }
  return canonical;
}

/**
 * Fail-closed reasonCode require for focused inventing proofs where a present
 * reason must already be canonical. Soft empty fails closed rather than
 * inventing a clean reason code from padding.
 */
export function requireCanonicalInventoryOperationReasonCode(
  value: unknown
): string {
  const canonical = normalizeCanonicalInventoryOperationReasonCode(value);
  if (!canonical) {
    throw new Error("Enter a valid reason.");
  }
  return canonical;
}
