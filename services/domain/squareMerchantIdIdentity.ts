/**
 * Square OAuth merchant-id identity helpers (MISE-005TF).
 *
 * Pins Edge `parseTokenSet` OAuth `merchant_id` → durable
 * `SquareTokenSet.merchantId` prep outside the Expo UI graph so Node tests
 * can exercise inventing proofs without loading React Native. The prior path
 * Unicode-trimmed provider `merchant_id` through shared `stringField` before
 * storing it on exchanged/refreshed token sets
 * (`'\u2003ML_ABC123\u2003'.trim() === 'ML_ABC123'`), so NBSP/em-space
 * padding invented a clean merchant identity used for
 * `service_complete_square_oauth` `p_merchant_id`, POS connection authority,
 * and later webhook merchant routing. Soft-empty Unicode-only padding also
 * collapsed through `.trim()` into the intentional empty →
 * `token_response_invalid` fail path.
 *
 * These are Square **OAuth merchant** tokens only — not Square location-list
 * `externalLocationId` (#943 / MISE-005TE), not Square order-sale
 * `provider_location_id` (#938 / MISE-005SZ), not hosted verified-provider
 * mapping `providerLocationId` (#936 / MISE-005SX), not Square order-sale
 * `provider_variation_id` / `catalog_object_id` (#939 / MISE-005TA), not
 * order `id` / `source_record_id` (#940 / MISE-005TB), not sale `item_name`
 * (#941 / MISE-005TC), not line `uid` (#942 / MISE-005TD), not catalog
 * variation list `id` → `external_variation_id`, not catalog item `id` /
 * `name` / `external_name`, not webhook payload `merchant_id` pass-through,
 * and not repository Square integration error haystacks (#929 /
 * MISE-005SQ). Soft empty / Unicode-padded / overlong / control-bearing
 * tokens soft-null so padded merchant IDs cannot invent durable
 * `SquareTokenSet.merchantId` identity. Ordinary ASCII whitespace still
 * trims clean. Case and accents are left unchanged.
 *
 * Complements open Square location-list tip #943 / MISE-005TE and order-sale
 * tips without sharing those modules or rewriting sibling `stringField`
 * call sites. Leave shared `stringField` itself and other parseTokenSet
 * fields (access_token, refresh_token, scope, expires_at) alone for
 * separate tips.
 */

const MAX_SQUARE_MERCHANT_ID = 128;

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized merchant identity before it is stored on
 * durable `SquareTokenSet.merchantId`.
 */
export function asciiTrimSquareMerchantId(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Square OAuth merchant id under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded,
 * overlong, or containing ASCII controls.
 */
export function canonicalizeSquareMerchantId(value: string): string | null {
  const trimmed = asciiTrimSquareMerchantId(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (trimmed.length > MAX_SQUARE_MERCHANT_ID) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Square `parseTokenSet` `merchant_id` → `merchantId`.
 * Preserves soft empty → null (prior `stringField` emptiness →
 * `token_response_invalid`) while refusing to invent a clean merchant id via
 * Unicode em-space trim. Does not throw; Unicode-padded / unsafe /
 * non-string tokens return null so the live `if (!accessToken || !merchantId)`
 * branch owns the fail-closed path without inventing a clean durable merchant
 * identity from padding.
 */
export function normalizeSquareMerchantId(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those into the intentional empty merchant fail path. Do not
  // invent a merchant id from padding.
  if (!value.trim()) return null;
  return canonicalizeSquareMerchantId(value);
}
