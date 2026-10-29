/**
 * Square OAuth access/refresh token identity helpers (MISE-005TR).
 *
 * Pins Edge `parseTokenSet` OAuth `access_token` / `refresh_token` → durable
 * `SquareTokenSet.accessToken` / `refreshToken` prep outside the Expo UI graph
 * so Node tests can exercise inventing proofs without loading React Native.
 * The prior path Unicode-trimmed provider tokens through shared `stringField`
 * before storing them on exchanged/refreshed token sets
 * (`'\u2003sq0at-ABC\u2003'.trim() === 'sq0at-ABC'`), so NBSP/em-space
 * padding invented a clean opaque credential used for Bearer authorization,
 * Vault refresh storage, and later token refresh / revoke. Soft-empty /
 * Unicode-only padding also collapsed through `.trim()` into the intentional
 * empty → `token_response_invalid` / `refresh_token_missing` fail paths.
 *
 * These are Square **OAuth opaque access/refresh credentials** only — not
 * Square OAuth `merchant_id` (#944 / MISE-005TF), not OAuth `scope` →
 * `grantedScopes` (#954 / MISE-005TP), not OAuth `expires_at` (#953 /
 * MISE-005TO), not OAuth token-endpoint `code` / `error` (#955 /
 * MISE-005TQ), not Square location-list / catalog / order-sale identities,
 * and not repository Square integration error haystacks (#929 /
 * MISE-005SQ). Soft empty / Unicode-padded / overlong / control-bearing
 * tokens soft-null so padded provider credentials cannot invent durable
 * `SquareTokenSet` access/refresh identity. Ordinary ASCII whitespace still
 * trims clean. Case and accents are left unchanged.
 *
 * Complements open Square OAuth merchant_id tip #944 / MISE-005TF, scope tip
 * #954 / MISE-005TP, expires_at tip #953 / MISE-005TO, and token-endpoint
 * error-code tip #955 / MISE-005TQ without sharing those modules or
 * rewriting sibling `stringField` call sites. Leave shared `stringField`
 * itself and remaining parseTokenSet fields (merchant_id, scope, expires_at)
 * alone for their separate tips.
 */

const MAX_SQUARE_OAUTH_ACCESS_OR_REFRESH_TOKEN = 4096;

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized opaque credential before it is stored on
 * durable `SquareTokenSet.accessToken` / `refreshToken`.
 */
export function asciiTrimSquareOAuthAccessOrRefreshToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Square OAuth access or refresh token under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded,
 * overlong, or containing ASCII controls.
 */
export function canonicalizeSquareOAuthAccessOrRefreshToken(
  value: string
): string | null {
  const trimmed = asciiTrimSquareOAuthAccessOrRefreshToken(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (trimmed.length > MAX_SQUARE_OAUTH_ACCESS_OR_REFRESH_TOKEN) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Square `parseTokenSet` `access_token` / `refresh_token`.
 * Preserves soft empty → null (prior `stringField` emptiness →
 * `token_response_invalid` / `refresh_token_missing`) while refusing to
 * invent a clean opaque credential via Unicode em-space trim. Does not
 * throw; Unicode-padded / unsafe / non-string tokens return null so the live
 * `if (!accessToken || !merchantId)` / `if (requireRefresh && !refreshToken)`
 * branches own the fail-closed path without inventing a clean durable
 * credential from padding.
 */
export function normalizeSquareOAuthAccessOrRefreshToken(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those into the intentional empty token fail path. Do not
  // invent an opaque credential from padding.
  if (!value.trim()) return null;
  return canonicalizeSquareOAuthAccessOrRefreshToken(value);
}
