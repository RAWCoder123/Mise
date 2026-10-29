/**
 * Square catalog/location-list external-location identity helpers (MISE-005TE).
 *
 * Pins Edge `listSquareLocations` location `id` → durable
 * `SquareLocation.externalLocationId` prep outside the Expo UI graph so
 * Node tests can exercise inventing proofs without loading React Native.
 * The prior path Unicode-trimmed provider location `id` through shared
 * `stringField` before storing it on listed Square locations
 * (`'\u2003LOC_ABC123\u2003'.trim() === 'LOC_ABC123'`), so NBSP/em-space
 * padding invented a clean external location identity used for OAuth
 * primary-location selection, `pos_locations` linking, and later POS
 * sale matching. Soft-empty Unicode-only padding also collapsed through
 * `.trim()` into the intentional empty → drop-null filter.
 *
 * These are Square **location-list external location** tokens only — not
 * Square order-sale `provider_location_id` ingestion (#938 / MISE-005SZ),
 * not hosted verified-provider mapping `providerLocationId` hydrate
 * (#936 / MISE-005SX), not Square order-sale `provider_variation_id` /
 * `catalog_object_id` (#939 / MISE-005TA), not order `id` /
 * `source_record_id` (#940 / MISE-005TB), not sale `item_name` (#941 /
 * MISE-005TC), not line `uid` (#942 / MISE-005TD), not OAuth
 * `merchant_id`, not catalog variation list `id` →
 * `external_variation_id`, not catalog item `name` / `external_name`,
 * and not repository Square integration error haystacks (#929 /
 * MISE-005SQ). Soft empty / Unicode-padded / overlong / control-bearing
 * tokens soft-null so padded location IDs cannot invent durable
 * `externalLocationId` identity. Ordinary ASCII whitespace still trims
 * clean. Case and accents are left unchanged.
 *
 * Complements open Square order-sale location tip #938 / MISE-005SZ and
 * verified-provider location tip #936 / MISE-005SX without sharing those
 * modules or rewriting sibling `stringField` call sites. Leave shared
 * `stringField` itself and other listSquareLocations fields (display
 * `name`, timezone) alone for separate tips.
 */

const MAX_SQUARE_LOCATION_EXTERNAL_ID = 128;

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized external location identity before it is
 * stored on durable `SquareLocation.externalLocationId`.
 */
export function asciiTrimSquareLocationExternalId(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Square location-list external id under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded,
 * overlong, or containing ASCII controls.
 */
export function canonicalizeSquareLocationExternalId(
  value: string
): string | null {
  const trimmed = asciiTrimSquareLocationExternalId(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (trimmed.length > MAX_SQUARE_LOCATION_EXTERNAL_ID) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Square `listSquareLocations` location `id` →
 * `externalLocationId`. Preserves soft empty → null (prior `stringField`
 * emptiness → drop-null filter) while refusing to invent a clean
 * external location id via Unicode em-space trim. Does not throw;
 * Unicode-padded / unsafe / non-string tokens return null so the live
 * `if (!id) return null` branch owns the drop without inventing a clean
 * durable location identity from padding.
 */
export function normalizeSquareLocationExternalId(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those into the intentional empty location drop. Do not invent
  // an external location id from padding.
  if (!value.trim()) return null;
  return canonicalizeSquareLocationExternalId(value);
}
