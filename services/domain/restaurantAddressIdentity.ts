/**
 * Restaurant address identity helpers (MISE-005PP).
 *
 * Pins miseValidation restaurant-profile `address` prep outside the repository
 * graph so Node tests can exercise inventing proofs without loading Supabase
 * or AsyncStorage. Profile address previously Unicode-trimmed (`.trim()` only
 * via `requireNullableBoundedText`), so NBSP/em-space padding invented a clean
 * durable address before `update_restaurant_profile` stored it
 * (`'\u2003123 Main St\u2003'.trim() === '123 Main St'`).
 *
 * Restaurant address is a single-line profile identity field (bounded to 500
 * characters on the hosted `restaurants.address` length check), not free-form
 * multiline prose. Only ASCII end trim is pinned; case and accents are left
 * unchanged so presentation stays operator-faithful. Soft empty (ASCII
 * whitespace or Unicode-only space) stays soft-null so profile patches can
 * clear or omit an address without inventing text from padding. Unicode-
 * padded non-empty tokens fail closed rather than inventing equality with the
 * unpadded address.
 *
 * Complements open restaurants address/cuisine SQL cntrl pin #549 / MISE-005EK
 * (which still Unicode-trims inside its `requireRestaurantAddress`) without
 * sharing that migration or rewriting sibling restaurant-name inventing
 * (#844 / MISE-005PJ), cuisine inventing (#842 / MISE-005PH), operational
 * profile notes via `requireNullableBoundedText`, setupDrafts / setup UI
 * emptiness checks, or hydrate `asNullableString(value.address)` pass-through.
 * Those remain on their existing contracts in this tip.
 *
 * Max length stays 500 to match `RESTAURANT_ADDRESS_MAX_CHARACTERS` and the
 * hosted `restaurants_address_length_check`. Soft empty after prep stays
 * `null` so an omitted/cleared address stays ordinary. Live require preserves
 * the prior messages (`Restaurant address must be text or empty.` /
 * `Restaurant address is limited to 500 characters.`).
 */

import { RESTAURANT_ADDRESS_MAX_CHARACTERS } from "./securityLimits";

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized restaurant address before it is stored as
 * durable restaurant profile identity.
 */
export function asciiTrimRestaurantAddressToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a restaurant address under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeRestaurantAddressToken(
  value: string
): string | null {
  const trimmed = asciiTrimRestaurantAddressToken(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft canonicalize for optional address emptiness checks. Preserves soft
 * empty → `null` (prior `.trim() || null` emptiness) while refusing to invent
 * a clean address via Unicode em-space trim. Does not throw; does not
 * soft-truncate (fail-closed require owns the 500 bound for the live
 * application path).
 */
export function canonicalizeRestaurantAddress(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those. Do not invent an address from padding.
  if (!value.trim()) return null;
  return canonicalizeRestaurantAddressToken(value);
}

/**
 * Fail-closed address normalize for `requireRestaurantAddress` and inventing
 * proofs. Soft empty → `null`. Unsafe-control / over-long / non-string /
 * Unicode-padded tokens fail with distinct messages.
 *
 * Error contracts:
 * - non-string / unsafe control / Unicode-padded → `Restaurant address must be text or empty.`
 * - over-long (>500 after prep) → `Restaurant address is limited to 500 characters.`
 */
export function normalizeCanonicalRestaurantAddress(
  value: unknown
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    throw new Error("Restaurant address must be text or empty.");
  }
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those. Do not invent an address from padding.
  if (!value.trim()) return null;
  const canonical = canonicalizeRestaurantAddressToken(value);
  if (!canonical) {
    throw new Error("Restaurant address must be text or empty.");
  }
  if (canonical.length > RESTAURANT_ADDRESS_MAX_CHARACTERS) {
    throw new Error(
      `Restaurant address is limited to ${RESTAURANT_ADDRESS_MAX_CHARACTERS} characters.`
    );
  }
  return canonical;
}

/**
 * Fail-closed address require for focused inventing proofs where a present
 * address must already be canonical. Soft empty fails closed rather than
 * inventing text.
 */
export function requireCanonicalRestaurantAddress(value: unknown): string {
  const canonical = normalizeCanonicalRestaurantAddress(value);
  if (!canonical) {
    throw new Error("Restaurant address must be text or empty.");
  }
  return canonical;
}
