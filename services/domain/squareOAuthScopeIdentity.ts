/**
 * Square OAuth scope / grantedScopes identity helpers (MISE-005TP).
 *
 * Pins Edge `parseTokenSet` OAuth `scope` → durable
 * `SquareTokenSet.grantedScopes` prep outside the Expo UI graph so Node tests
 * can exercise inventing proofs without loading React Native. The prior path
 * Unicode-trimmed provider `scope` through shared `stringField` before
 * splitting and storing granted scope tokens on exchanged/refreshed token
 * sets (`'\u2003MERCHANT_PROFILE_READ ITEMS_READ ORDERS_READ\u2003'.trim() ===
 * 'MERCHANT_PROFILE_READ ITEMS_READ ORDERS_READ'`), so NBSP/em-space padding
 * invented a clean scope grant string that passed the required-scope
 * authorization gate and was carried as `SquareTokenSet.grantedScopes`. Soft
 * empty / Unicode-only padding also collapsed through `.trim()` into the
 * intentional empty → `square_scope_missing` fail path.
 *
 * These are Square **OAuth granted scope tokens** only — not Square OAuth
 * `merchant_id` (#944 / MISE-005TF), not OAuth `expires_at` (#953 /
 * MISE-005TO), not OAuth `access_token` / `refresh_token` siblings, not
 * Square location-list / catalog / order-sale identities, and not repository
 * Square integration error haystacks (#929 / MISE-005SQ). Soft empty /
 * Unicode-padded / overlong / control-bearing fields soft-empty to `[]` so
 * padded scope strings cannot invent durable `grantedScopes` identity.
 * Ordinary ASCII whitespace still trims clean. Case and accents are left
 * unchanged.
 *
 * Complements open Square OAuth merchant tip #944 / MISE-005TF and expires_at
 * tip #953 / MISE-005TO without sharing those modules or rewriting sibling
 * `stringField` call sites. Leave shared `stringField` itself and other
 * parseTokenSet fields (access_token, refresh_token, merchant_id, expires_at)
 * alone for separate tips.
 */

const MAX_SQUARE_OAUTH_SCOPE_FIELD = 2000;
const MAX_SQUARE_OAUTH_SCOPE_TOKEN = 128;

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized scope grant string before it is split into
 * durable `SquareTokenSet.grantedScopes`.
 */
export function asciiTrimSquareOAuthScopeField(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

/**
 * ASCII-only end trim for one granted scope token after delimiter split.
 */
export function asciiTrimSquareOAuthScopeToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize one Square OAuth scope token under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded,
 * overlong, or containing ASCII controls.
 */
export function canonicalizeSquareOAuthScopeToken(value: string): string | null {
  const trimmed = asciiTrimSquareOAuthScopeToken(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (trimmed.length > MAX_SQUARE_OAUTH_SCOPE_TOKEN) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Square `parseTokenSet` `scope` → `grantedScopes`.
 * Preserves soft empty → `[]` (prior `stringField` emptiness → empty grants
 * → `square_scope_missing`) while refusing to invent a clean scope grant
 * string via Unicode em-space trim. Does not throw; Unicode-padded / unsafe /
 * non-string fields return `[]` so the live required-scope loop owns the
 * fail-closed `square_scope_missing` path without inventing clean durable
 * granted scope identity from padding.
 */
export function normalizeSquareOAuthGrantedScopes(
  value: string | null | undefined
): string[] {
  if (value === null || value === undefined || value === "") return [];
  if (typeof value !== "string") return [];
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those into the intentional empty grantedScopes path. Do not
  // invent scope grants from padding.
  if (!value.trim()) return [];

  const field = asciiTrimSquareOAuthScopeField(value);
  if (!field) return [];
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (field !== field.trim()) return [];
  if (field.length > MAX_SQUARE_OAUTH_SCOPE_FIELD) return [];
  if (hasControlCharacters(field)) return [];

  return field
    .split(/[,\s]+/u)
    .map((scope) => canonicalizeSquareOAuthScopeToken(scope))
    .filter((scope): scope is string => Boolean(scope));
}
