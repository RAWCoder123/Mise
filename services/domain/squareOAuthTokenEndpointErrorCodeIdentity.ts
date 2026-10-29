/**
 * Square OAuth token-endpoint error-code identity helpers (MISE-005TQ).
 *
 * Pins Edge `tokenEndpointError` OAuth token-endpoint `code` / `error` →
 * `unauthorized_client` disposition classification outside the Expo UI graph
 * so Node tests can exercise inventing proofs without loading React Native.
 * The prior path Unicode-trimmed provider `code` (falling back to `error`)
 * through shared `stringField` before the
 * `code === "unauthorized_client"` reauthorize gate
 * (`'\u2003unauthorized_client\u2003'.trim() === 'unauthorized_client'`), so
 * NBSP/em-space padding invented a clean provider error code that flipped a
 * non-401 token-endpoint failure into `SquareProviderError` safe code
 * `square_unauthorized` with disposition `reauthorize`. Soft-empty /
 * Unicode-only padding also collapsed through `.trim()` into the intentional
 * empty → fall-through `square_token_exchange_failed` / `ambiguous` path.
 *
 * These are Square **OAuth token-endpoint provider error codes** only — not
 * Square OAuth `scope` → `grantedScopes` (#954 / MISE-005TP), not OAuth
 * `expires_at` (#953 / MISE-005TO), not OAuth `merchant_id` (#944 /
 * MISE-005TF), not OAuth `access_token` / `refresh_token` siblings, not
 * Square location-list / catalog / order-sale identities, and not repository
 * Square integration error haystacks (#929 / MISE-005SQ). Soft empty /
 * Unicode-padded / overlong / control-bearing tokens soft-empty so padded
 * provider error codes cannot invent the `unauthorized_client` reauthorize
 * disposition. Ordinary ASCII whitespace still trims clean. Case and accents
 * are left unchanged.
 *
 * Complements open Square OAuth scope tip #954 / MISE-005TP and expires_at tip
 * #953 / MISE-005TO without sharing those modules or rewriting sibling
 * `stringField` call sites. Leave shared `stringField` itself and
 * parseTokenSet fields (access_token, refresh_token, merchant_id, scope,
 * expires_at) alone for separate tips.
 */

const MAX_SQUARE_OAUTH_TOKEN_ENDPOINT_ERROR_CODE = 80;

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized provider error code before the
 * `unauthorized_client` reauthorize disposition gate.
 */
export function asciiTrimSquareOAuthTokenEndpointErrorCode(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Square OAuth token-endpoint provider error code under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded,
 * overlong, or containing ASCII controls.
 */
export function canonicalizeSquareOAuthTokenEndpointErrorCode(
  value: string
): string | null {
  const trimmed = asciiTrimSquareOAuthTokenEndpointErrorCode(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (trimmed.length > MAX_SQUARE_OAUTH_TOKEN_ENDPOINT_ERROR_CODE) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Square `tokenEndpointError` `code` / `error`.
 * Preserves soft empty → null (prior `stringField` emptiness → empty code →
 * fall through past `unauthorized_client`) while refusing to invent a clean
 * `unauthorized_client` code via Unicode em-space trim. Does not throw;
 * Unicode-padded / unsafe / non-string tokens return null so padded provider
 * error codes cannot invent the reauthorize disposition from padding.
 */
export function normalizeSquareOAuthTokenEndpointErrorCode(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those into the intentional empty code path. Do not invent a
  // provider error code from padding.
  if (!value.trim()) return null;
  return canonicalizeSquareOAuthTokenEndpointErrorCode(value);
}
