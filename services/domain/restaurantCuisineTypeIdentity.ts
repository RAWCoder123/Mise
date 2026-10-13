/**
 * Restaurant cuisine_type identity helpers (MISE-005PH).
 *
 * Pins miseValidation `requireRestaurantCuisineType` (and the demo create /
 * session demo-profile paths that feed cuisine into restaurant profile writes)
 * outside the repository graph so Node tests can exercise inventing proofs
 * without loading Supabase or AsyncStorage. Cuisine type previously
 * Unicode-trimmed (`.trim()` only), so NBSP/em-space padding invented a clean
 * durable cuisine string before create/profile patches stored it
 * (`'\u2003Italian\u2003'.trim() === 'Italian'`).
 *
 * Cuisine type is a single-line profile identity field (bounded to 120
 * characters on the hosted `restaurants.cuisine_type` check), not free-form
 * multiline prose. Only ASCII end trim is pinned; case and accents are left
 * unchanged so presentation stays operator-faithful. Soft empty (ASCII
 * whitespace or Unicode-only space) stays soft-null so create/profile can keep
 * a prior null/empty cuisine without inventing text from padding. Unicode-
 * padded non-empty tokens fail closed rather than inventing equality with the
 * unpadded cuisine.
 *
 * Complements open restaurants address/cuisine SQL cntrl pin #549 / MISE-005EK
 * and beta provisioning name/cuisine cntrl pin #656 / MISE-005IN without
 * sharing those migrations or rewriting sibling restaurant-name inventing
 * (name require helper / session profile name trim), setupDrafts /
 * setup UI emptiness checks, or miseDomain cuisine readiness emptiness
 * presentation. Those remain on their existing contracts in this tip.
 *
 * Max length stays 120 to match `RESTAURANT_CUISINE_MAX_CHARACTERS` and the
 * hosted `restaurants_cuisine_type_length_check`. Soft empty after prep stays
 * `null` so an omitted cuisine stays ordinary. Live require preserves the
 * prior messages (`Cuisine type must be text or empty.` /
 * `Cuisine type is limited to 120 characters.`).
 */

import { RESTAURANT_CUISINE_MAX_CHARACTERS } from "./securityLimits";

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized cuisine type before it is stored as
 * durable restaurant profile identity.
 */
export function asciiTrimRestaurantCuisineTypeToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a restaurant cuisine type under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeRestaurantCuisineTypeToken(
  value: string
): string | null {
  const trimmed = asciiTrimRestaurantCuisineTypeToken(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft canonicalize for demo create and session demo-profile patch
 * application. Preserves soft empty → `null` (prior `.trim() || fallback`
 * emptiness) while refusing to invent a clean cuisine via Unicode em-space
 * trim. Does not throw; does not soft-truncate (fail-closed require owns the
 * 120 bound for the live application path).
 */
export function canonicalizeRestaurantCuisineType(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those. Do not invent a cuisine from padding.
  if (!value.trim()) return null;
  return canonicalizeRestaurantCuisineTypeToken(value);
}

/**
 * Fail-closed cuisine normalize for `requireRestaurantCuisineType` and
 * inventing proofs. Soft empty → `null`. Unsafe-control / over-long /
 * non-string / Unicode-padded tokens fail with distinct messages.
 *
 * Error contracts:
 * - non-string / unsafe control / Unicode-padded → `Cuisine type must be text or empty.`
 * - over-long (>120 after prep) → `Cuisine type is limited to 120 characters.`
 */
export function normalizeCanonicalRestaurantCuisineType(
  value: unknown
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    throw new Error("Cuisine type must be text or empty.");
  }
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those. Do not invent a cuisine from padding.
  if (!value.trim()) return null;
  const canonical = canonicalizeRestaurantCuisineTypeToken(value);
  if (!canonical) {
    throw new Error("Cuisine type must be text or empty.");
  }
  if (canonical.length > RESTAURANT_CUISINE_MAX_CHARACTERS) {
    throw new Error(
      `Cuisine type is limited to ${RESTAURANT_CUISINE_MAX_CHARACTERS} characters.`
    );
  }
  return canonical;
}

/**
 * Fail-closed cuisine require for focused inventing proofs where a present
 * cuisine must already be canonical. Soft empty fails closed rather than
 * inventing text.
 */
export function requireCanonicalRestaurantCuisineType(value: unknown): string {
  const canonical = normalizeCanonicalRestaurantCuisineType(value);
  if (!canonical) {
    throw new Error("Cuisine type must be text or empty.");
  }
  return canonical;
}
