/**
 * Square catalog variation external-id identity helpers (MISE-005TG).
 *
 * Pins Edge `normalizeCatalogItem` variation list `id` → durable
 * `SquareCatalogRow.external_variation_id` prep outside the Expo UI graph so
 * Node tests can exercise inventing proofs without loading React Native.
 * The prior path Unicode-trimmed variation `id` through shared `stringField`
 * before storing it on normalized catalog rows
 * (`'\u2003var-1\u2003'.trim() === 'var-1'`), so NBSP/em-space padding
 * invented a clean external variation identity used for POS catalog mapping,
 * verified recipe mapping, and inventory planning. Soft-empty Unicode-only
 * padding also collapsed through `.trim()` into the intentional empty →
 * `""` external variation id.
 *
 * These are Square **catalog variation list** tokens only — not Square
 * order-sale `catalog_object_id` → `provider_variation_id` (#939 /
 * MISE-005TA), not Square location-list `externalLocationId` (#943 /
 * MISE-005TE), not Square OAuth `merchant_id` (#944 / MISE-005TF), not
 * catalog item `id` → `external_catalog_item_id`, not catalog item `name` /
 * `external_name`, not `variation_name`, not order-sale line `uid` /
 * `item_name` / order `id` / `provider_location_id`, and not repository
 * Square integration error haystacks (#929 / MISE-005SQ). Soft empty /
 * Unicode-padded / overlong / control-bearing tokens soft-null so padded
 * variation IDs cannot invent durable `external_variation_id` identity.
 * Ordinary ASCII whitespace still trims clean. Case and accents are left
 * unchanged.
 *
 * Complements open Square order-sale variation tip #939 / MISE-005TA without
 * sharing that module or rewriting sibling `stringField` call sites.
 * Leave shared `stringField` itself and other normalizeCatalogItem fields
 * (item id, item name, variation name, product_type, category_id) alone for
 * separate tips.
 */

const MAX_SQUARE_CATALOG_VARIATION_EXTERNAL_ID = 128;

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized external variation identity before it is
 * stored on durable `SquareCatalogRow.external_variation_id`.
 */
export function asciiTrimSquareCatalogVariationExternalId(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Square catalog variation external id under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded,
 * overlong, or containing ASCII controls.
 */
export function canonicalizeSquareCatalogVariationExternalId(
  value: string
): string | null {
  const trimmed = asciiTrimSquareCatalogVariationExternalId(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (trimmed.length > MAX_SQUARE_CATALOG_VARIATION_EXTERNAL_ID) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Square `normalizeCatalogItem` variation `id` →
 * `external_variation_id`. Preserves soft empty → null (prior `stringField`
 * emptiness → `""` external variation id via `?? ""`) while refusing to
 * invent a clean variation id via Unicode em-space trim. Does not throw;
 * Unicode-padded / unsafe / non-string tokens return null so the live
 * `?? ""` branch owns the empty external variation id without inventing a
 * clean durable identity from padding.
 */
export function normalizeSquareCatalogVariationExternalId(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those into the intentional empty external variation id. Do not
  // invent a catalog variation id from padding.
  if (!value.trim()) return null;
  return canonicalizeSquareCatalogVariationExternalId(value);
}
