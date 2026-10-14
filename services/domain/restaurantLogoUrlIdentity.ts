/**
 * Restaurant logo_url identity helpers (MISE-005PS).
 *
 * Pins miseValidation restaurant-profile `logo_url` prep outside the repository
 * graph so Node tests can exercise inventing proofs without loading Supabase
 * or AsyncStorage. Logo URL previously Unicode-trimmed (`.trim()` only via
 * `requireNullableBoundedText` inside `requireHttpsLogoUrl`), so NBSP/em-space
 * padding invented a clean durable HTTPS logo URL before
 * `update_restaurant_profile` stored it
 * (`'\u2003https://cdn.example.com/logo.png\u2003'.trim() ===
 * 'https://cdn.example.com/logo.png'`).
 *
 * Logo URL is a single-line profile identity field (bounded to 2048 characters
 * on the hosted `restaurants.logo_url` check), not free-form multiline prose.
 * Only ASCII end trim is pinned; case is left unchanged so presentation stays
 * operator-faithful. Soft empty (ASCII whitespace or Unicode-only space) stays
 * soft-null so profile patches can clear or omit a logo without inventing a
 * URL from padding. Unicode-padded non-empty tokens fail closed rather than
 * inventing equality with the unpadded HTTPS URL. After ASCII C prep, the URL
 * must still be a credential-free HTTPS URL with a public hostname, matching
 * the prior `requireHttpsLogoUrl` contract.
 *
 * Complements open restaurant address inventing (#850 / MISE-005PP),
 * operational profile notes inventing (#851 / MISE-005PQ), cuisine inventing
 * (#842 / MISE-005PH), and restaurant-name inventing (#844 / MISE-005PJ)
 * without sharing those modules or rewriting sibling address / notes paths
 * that still call `requireNullableBoundedText` on main, setupDrafts / setup UI
 * emptiness checks, or hydrate `asNullableString(value.logo_url)` pass-through.
 * Those remain on their existing contracts in this tip.
 *
 * Max length stays 2048 to match `RESTAURANT_LOGO_URL_MAX_CHARACTERS` and the
 * hosted `restaurants_logo_url_check`. Soft empty after prep stays `null` so an
 * omitted/cleared logo stays ordinary. Live require preserves the prior
 * messages (`Logo URL must be text or empty.` /
 * `Logo URL is limited to 2048 characters.` /
 * `Logo URL must be a valid HTTPS URL.`).
 */

import { RESTAURANT_LOGO_URL_MAX_CHARACTERS } from "./securityLimits";

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized logo URL before it is stored as
 * durable restaurant profile identity.
 */
export function asciiTrimRestaurantLogoUrlToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

function isValidHttpsLogoUrl(value: string) {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      Boolean(url.username || url.password) ||
      !/^(?:[a-z0-9-]+\.)+[a-z]{2,63}$/i.test(url.hostname)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Canonicalize a restaurant logo URL under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeRestaurantLogoUrlToken(
  value: string
): string | null {
  const trimmed = asciiTrimRestaurantLogoUrlToken(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft canonicalize for optional logo emptiness checks. Preserves soft
 * empty → `null` (prior `.trim() || null` emptiness) while refusing to invent
 * a clean logo URL via Unicode em-space trim. Does not throw; does not
 * soft-truncate (fail-closed require owns the 2048 bound and HTTPS check for
 * the live application path).
 */
export function canonicalizeRestaurantLogoUrl(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those. Do not invent a logo URL from padding.
  if (!value.trim()) return null;
  return canonicalizeRestaurantLogoUrlToken(value);
}

/**
 * Fail-closed logo URL normalize for `requireHttpsLogoUrl` and inventing
 * proofs. Soft empty → `null`. Unsafe-control / over-long / non-string /
 * Unicode-padded tokens fail with distinct messages. After ASCII C prep, the
 * token must still be a credential-free HTTPS URL.
 *
 * Error contracts:
 * - non-string / unsafe control / Unicode-padded → `Logo URL must be text or empty.`
 * - over-long (>2048 after prep) → `Logo URL is limited to 2048 characters.`
 * - non-HTTPS / credentialed / invalid host → `Logo URL must be a valid HTTPS URL.`
 */
export function normalizeCanonicalRestaurantLogoUrl(
  value: unknown
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    throw new Error("Logo URL must be text or empty.");
  }
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those. Do not invent a logo URL from padding.
  if (!value.trim()) return null;
  const canonical = canonicalizeRestaurantLogoUrlToken(value);
  if (!canonical) {
    throw new Error("Logo URL must be text or empty.");
  }
  if (canonical.length > RESTAURANT_LOGO_URL_MAX_CHARACTERS) {
    throw new Error(
      `Logo URL is limited to ${RESTAURANT_LOGO_URL_MAX_CHARACTERS} characters.`
    );
  }
  if (!isValidHttpsLogoUrl(canonical)) {
    throw new Error("Logo URL must be a valid HTTPS URL.");
  }
  return canonical;
}

/**
 * Fail-closed logo URL require for focused inventing proofs where a present
 * logo URL must already be canonical. Soft empty fails closed rather than
 * inventing a URL.
 */
export function requireCanonicalRestaurantLogoUrl(value: unknown): string {
  const canonical = normalizeCanonicalRestaurantLogoUrl(value);
  if (!canonical) {
    throw new Error("Logo URL must be text or empty.");
  }
  return canonical;
}
