/**
 * Operational profile array-entry identity helpers (MISE-005PR).
 *
 * Pins miseValidation `requireBoundedStringArray` entry prep for
 * `orderCadence`, `prepWindows`, `primarySuppliers`, and
 * `inventoryReviewDays` outside the repository graph so Node tests can
 * exercise inventing proofs without loading Supabase or AsyncStorage.
 * Array entries previously Unicode-trimmed (`entry.trim()` only), so
 * NBSP/em-space padding invented a clean durable entry before
 * `update_restaurant_profile` stored it
 * (`'\u2003Monday\u2003'.trim() === 'Monday'`).
 *
 * These entries are single-line profile identity labels (bounded to 160
 * characters each, max 20 per array on the hosted
 * `private.restaurant_operational_profile_is_valid` check), not free-form
 * multiline prose. Only ASCII end trim is pinned; case and accents are left
 * unchanged so presentation stays operator-faithful. Soft empty (ASCII
 * whitespace or Unicode-only space) stays empty so the live require can keep
 * its prior `entries must be between 1 and 160 characters` contract. Unicode-
 * padded non-empty tokens fail closed rather than inventing equality with the
 * unpadded entry.
 *
 * Complements open operational profile notes inventing tip (#851 /
 * MISE-005PQ), restaurant address inventing (#850 / MISE-005PP), cuisine
 * inventing (#842 / MISE-005PH), and restaurant-name inventing (#844 /
 * MISE-005PJ) without rewriting those helpers. Intentionally does not change
 * `requireNullableBoundedText` (still used by logo URL, and by address until
 * #850 lands) or hydrate `asStringArray` pass-through. Those remain on their
 * existing contracts in this tip.
 *
 * Max length stays 160 to match `RESTAURANT_PROFILE_ARRAY_ITEM_MAX_CHARACTERS`
 * and the hosted array-entry length bound. Live require preserves the prior
 * messages (`${label} entries must be text.` /
 * `${label} entries must be between 1 and 160 characters.`).
 */

import { RESTAURANT_PROFILE_ARRAY_ITEM_MAX_CHARACTERS } from "./securityLimits";

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized array entry before it is stored as
 * durable operational-profile identity.
 */
export function asciiTrimOperationalProfileArrayEntryToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize one operational profile array entry under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeOperationalProfileArrayEntryToken(
  value: string
): string | null {
  const trimmed = asciiTrimOperationalProfileArrayEntryToken(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft canonicalize for emptiness checks. Preserves soft empty → `null`
 * (prior `.trim()` emptiness) while refusing to invent a clean entry via
 * Unicode em-space trim. Does not throw; does not soft-truncate (fail-closed
 * require owns the 160 bound for the live application path).
 */
export function canonicalizeOperationalProfileArrayEntry(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those. Do not invent an entry from padding.
  if (!value.trim()) return null;
  return canonicalizeOperationalProfileArrayEntryToken(value);
}

/**
 * Fail-closed array-entry normalize for `requireBoundedStringArray` and
 * inventing proofs. Soft empty → `null`. Unsafe-control / over-long /
 * non-string / Unicode-padded tokens fail with distinct messages.
 *
 * Error contracts (label-prefixed by the live require wrapper):
 * - non-string / unsafe control / Unicode-padded → `${label} entries must be text.`
 * - soft empty / over-long (>160 after prep) → `${label} entries must be between 1 and 160 characters.`
 */
export function normalizeCanonicalOperationalProfileArrayEntry(
  value: unknown,
  label: string
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    throw new Error(`${label} entries must be text.`);
  }
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those. Do not invent an entry from padding.
  if (!value.trim()) return null;
  const canonical = canonicalizeOperationalProfileArrayEntryToken(value);
  if (!canonical) {
    throw new Error(`${label} entries must be text.`);
  }
  if (canonical.length > RESTAURANT_PROFILE_ARRAY_ITEM_MAX_CHARACTERS) {
    throw new Error(
      `${label} entries must be between 1 and ${RESTAURANT_PROFILE_ARRAY_ITEM_MAX_CHARACTERS} characters.`
    );
  }
  return canonical;
}

/**
 * Fail-closed array-entry require for focused inventing proofs where a present
 * entry must already be canonical. Soft empty fails closed rather than
 * inventing text.
 */
export function requireCanonicalOperationalProfileArrayEntry(
  value: unknown,
  label: string
): string {
  const canonical = normalizeCanonicalOperationalProfileArrayEntry(value, label);
  if (!canonical) {
    throw new Error(
      `${label} entries must be between 1 and ${RESTAURANT_PROFILE_ARRAY_ITEM_MAX_CHARACTERS} characters.`
    );
  }
  return canonical;
}
