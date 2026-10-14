/**
 * Operator profile display-name identity helpers (MISE-005PO).
 *
 * Pins application `updateMyProfile` outside the repository graph so Node
 * tests can exercise inventing proofs without loading Supabase or
 * AsyncStorage. Profile name previously Unicode-trimmed (`.trim()` only), so
 * NBSP/em-space padding invented a clean durable operator display name before
 * the hosted `update_my_profile` RPC or demo mutate stored it
 * (`'\u2003Alex Rivera\u2003'.trim() === 'Alex Rivera'`).
 *
 * Profile name is a single-line operator identity field (bounded to 120
 * characters on the hosted writer and planned `users.name` CHECK), not
 * free-form multiline prose. Only ASCII end trim is pinned; case and accents
 * are left unchanged so presentation stays operator-faithful. Soft empty
 * (ASCII whitespace or Unicode-only space) stays soft-null on soft
 * canonicalize. Unicode-padded non-empty tokens fail closed on the live
 * require path rather than inventing equality with the unpadded name.
 *
 * Complements open users.name SQL cntrl pin #654 / MISE-005IL (which still
 * Unicode-trims inside `requireProfileName`) without sharing that migration
 * or rewriting presentation emptiness on `/more` (`user?.name?.trim()`),
 * restaurant-name inventing (#844 / MISE-005PJ), or hydrate
 * `normalizeAppUser`. Those remain on their existing contracts in this tip.
 *
 * Max length stays 120 to match `PROFILE_NAME_MAX_CHARACTERS` and the hosted
 * `update_my_profile` bound. Live require preserves the prior length message
 * (`Profile name must be between 1 and 120 characters.`) for soft empty /
 * over-long, and uses `Profile name is required.` for non-string / unsafe
 * control / Unicode-padded fail-closed cases (alone-OK with #654's future
 * `requireProfileName` message).
 */

import { PROFILE_NAME_MAX_CHARACTERS } from "./securityLimits";

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized operator display name before it is stored
 * as durable profile identity.
 */
export function asciiTrimUserProfileNameToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an operator profile name under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeUserProfileNameToken(
  value: string
): string | null {
  const trimmed = asciiTrimUserProfileNameToken(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft canonicalize for optional display emptiness checks. Preserves soft
 * empty → `null` (prior `.trim()` emptiness) while refusing to invent a clean
 * name via Unicode em-space trim. Does not throw; does not soft-truncate
 * (fail-closed require owns the 120 bound for the live application path).
 */
export function canonicalizeUserProfileName(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those. Do not invent a name from padding.
  if (!value.trim()) return null;
  return canonicalizeUserProfileNameToken(value);
}

/**
 * Fail-closed name normalize for `updateMyProfile` and inventing proofs.
 * Soft empty fails with the prior length message. Unsafe-control /
 * Unicode-padded / non-string tokens fail with `Profile name is required.`
 * Over-long fails with the prior length message.
 *
 * Error contracts:
 * - non-string / unsafe control / Unicode-padded → `Profile name is required.`
 * - soft empty / over-long → `Profile name must be between 1 and 120 characters.`
 */
export function normalizeCanonicalUserProfileName(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Profile name is required.");
  }
  // Soft empty for ASCII whitespace or Unicode-only space: prior `.trim()`
  // emptied those into the length bound check. Preserve that contract.
  if (!value.trim()) {
    throw new Error(
      `Profile name must be between 1 and ${PROFILE_NAME_MAX_CHARACTERS} characters.`
    );
  }
  const canonical = canonicalizeUserProfileNameToken(value);
  if (!canonical) {
    throw new Error("Profile name is required.");
  }
  if (
    canonical.length < 1 ||
    canonical.length > PROFILE_NAME_MAX_CHARACTERS
  ) {
    throw new Error(
      `Profile name must be between 1 and ${PROFILE_NAME_MAX_CHARACTERS} characters.`
    );
  }
  return canonical;
}

/**
 * Fail-closed name require for focused inventing proofs where a present
 * name must already be canonical.
 */
export function requireCanonicalUserProfileName(value: unknown): string {
  return normalizeCanonicalUserProfileName(value);
}
