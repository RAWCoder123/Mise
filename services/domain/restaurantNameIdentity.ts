/**
 * Restaurant name identity helpers (MISE-005PJ).
 *
 * Pins miseValidation `requireRestaurantName` (and the demo create /
 * session demo-profile paths that feed name into restaurant profile writes)
 * outside the repository graph so Node tests can exercise inventing proofs
 * without loading Supabase or AsyncStorage. Restaurant name previously
 * Unicode-trimmed (`.trim()` only), so NBSP/em-space padding invented a clean
 * durable restaurant name before create/profile patches stored it
 * (`'\u2003Bistro Nova\u2003'.trim() === 'Bistro Nova'`).
 *
 * Restaurant name is a single-line profile identity field (bounded to 120
 * characters on the hosted `restaurants.name` check), not free-form
 * multiline prose. Only ASCII end trim is pinned; case and accents are left
 * unchanged so presentation stays operator-faithful. Soft empty (ASCII
 * whitespace or Unicode-only space) stays soft-null on soft canonicalize so
 * demo/session can keep a prior name without inventing text from padding.
 * Unicode-padded non-empty tokens fail closed on the live require path rather
 * than inventing equality with the unpadded name.
 *
 * Complements open restaurants.name SQL cntrl pin #548 / MISE-005EJ and
 * demoDataset restaurant-name match tip #685 / MISE-005JP without sharing
 * those migrations or rewriting sibling cuisine inventing
 * (`requireRestaurantCuisineType` / session cuisine trim), setupDrafts /
 * setup UI emptiness checks, or user profile display-name trim.
 * Those remain on their existing contracts in this tip.
 *
 * Max length stays 120 to match `RESTAURANT_NAME_MAX_CHARACTERS` and the
 * hosted name bound. Live require preserves the prior messages
 * (`Restaurant name is required.` /
 * `Restaurant name must be between 1 and 120 characters.`).
 */

import { RESTAURANT_NAME_MAX_CHARACTERS } from "./securityLimits";

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized restaurant name before it is stored as
 * durable restaurant profile identity.
 */
export function asciiTrimRestaurantNameToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a restaurant name under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeRestaurantNameToken(
  value: string
): string | null {
  const trimmed = asciiTrimRestaurantNameToken(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft canonicalize for demo create and session demo-profile patch
 * application. Preserves soft empty → `null` (prior `.trim() || fallback`
 * emptiness) while refusing to invent a clean name via Unicode em-space
 * trim. Does not throw; does not soft-truncate (fail-closed require owns the
 * 120 bound for the live application path).
 */
export function canonicalizeRestaurantName(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those. Do not invent a name from padding.
  if (!value.trim()) return null;
  return canonicalizeRestaurantNameToken(value);
}

/**
 * Fail-closed name normalize for `requireRestaurantName` and inventing
 * proofs. Soft empty fails with the prior length message. Unsafe-control /
 * Unicode-padded / non-string tokens fail with `Restaurant name is required.`
 * Over-long fails with the prior length message.
 *
 * Error contracts:
 * - non-string / unsafe control / Unicode-padded → `Restaurant name is required.`
 * - soft empty / over-long → `Restaurant name must be between 1 and 120 characters.`
 */
export function normalizeCanonicalRestaurantName(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Restaurant name is required.");
  }
  // Soft empty for ASCII whitespace or Unicode-only space: prior `.trim()`
  // emptied those into the length bound check. Preserve that contract.
  if (!value.trim()) {
    throw new Error(
      `Restaurant name must be between 1 and ${RESTAURANT_NAME_MAX_CHARACTERS} characters.`
    );
  }
  const canonical = canonicalizeRestaurantNameToken(value);
  if (!canonical) {
    throw new Error("Restaurant name is required.");
  }
  if (
    canonical.length < 1 ||
    canonical.length > RESTAURANT_NAME_MAX_CHARACTERS
  ) {
    throw new Error(
      `Restaurant name must be between 1 and ${RESTAURANT_NAME_MAX_CHARACTERS} characters.`
    );
  }
  return canonical;
}

/**
 * Fail-closed name require for focused inventing proofs where a present
 * name must already be canonical.
 */
export function requireCanonicalRestaurantName(value: unknown): string {
  return normalizeCanonicalRestaurantName(value);
}
