/**
 * Square OAuth expires-at identity helpers (MISE-005TO).
 *
 * Pins Edge `parseTokenSet` OAuth `expires_at` → durable
 * `SquareTokenSet.expiresAt` prep outside the Expo UI graph so Node tests
 * can exercise inventing proofs without loading React Native. The prior path
 * Unicode-trimmed provider `expires_at` through shared `stringField` before
 * storing it on exchanged/refreshed token sets
 * (`'\u20032026-10-29T12:00:00.000Z\u2003'.trim() === '2026-10-29T12:00:00.000Z'`),
 * so NBSP/em-space padding invented a clean access-token expiry timestamp
 * carried on `SquareTokenSet.expiresAt` after token exchange and refresh.
 * Soft-empty Unicode-only padding also collapsed through `.trim()` into the
 * intentional empty string (typed as nullable `expiresAt`) via `stringField`
 * emptiness.
 *
 * These are Square **OAuth access-token expiry** timestamps only — not Square
 * OAuth `merchant_id` (#944 / MISE-005TF), not Square order-sale
 * `closed_at` / `created_at` → `sale_date` (#951 / MISE-005TM), not OAuth
 * `access_token` / `refresh_token` / `scope` siblings, not Square
 * location-list / catalog / order-sale identities, and not repository Square
 * integration error haystacks (#929 / MISE-005SQ). Soft empty /
 * Unicode-padded / overlong / control-bearing tokens soft-null so padded
 * expiry timestamps cannot invent durable `SquareTokenSet.expiresAt`
 * identity. Ordinary ASCII whitespace still trims clean. Case and accents
 * are left unchanged.
 *
 * Complements open Square OAuth merchant tip #944 / MISE-005TF and order-sale
 * closed-at tip #951 / MISE-005TM without sharing those modules or rewriting
 * sibling `stringField` call sites. Leave shared `stringField` itself and
 * other parseTokenSet fields (access_token, refresh_token, scope,
 * merchant_id) alone for separate tips.
 */

const MAX_SQUARE_OAUTH_EXPIRES_AT = 64;

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized expiry timestamp before it is stored on
 * durable `SquareTokenSet.expiresAt`.
 */
export function asciiTrimSquareOAuthExpiresAt(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Square OAuth expires_at timestamp under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded,
 * overlong, or containing ASCII controls.
 */
export function canonicalizeSquareOAuthExpiresAt(
  value: string
): string | null {
  const trimmed = asciiTrimSquareOAuthExpiresAt(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (trimmed.length > MAX_SQUARE_OAUTH_EXPIRES_AT) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Square `parseTokenSet` `expires_at` → `expiresAt`.
 * Preserves soft empty → null (prior `stringField` emptiness → empty /
 * nullable `expiresAt`) while refusing to invent a clean expiry timestamp
 * via Unicode em-space trim. Does not throw; Unicode-padded / unsafe /
 * non-string tokens return null so padded expiry timestamps cannot invent
 * durable `SquareTokenSet.expiresAt` identity from padding. Soft-null is
 * intentional: missing or unsafe expiry leaves `expiresAt` null without
 * failing the whole token exchange.
 */
export function normalizeSquareOAuthExpiresAt(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those into the intentional empty expiresAt path. Do not invent
  // an expiry timestamp from padding.
  if (!value.trim()) return null;
  return canonicalizeSquareOAuthExpiresAt(value);
}
