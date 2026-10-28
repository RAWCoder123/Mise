/**
 * Square order-sale provider-variation identity helpers (MISE-005TA).
 *
 * Pins Edge `normalizeOrderSales` `catalog_object_id` → durable
 * `SquareSaleRow.provider_variation_id` prep outside the Expo UI graph so
 * Node tests can exercise inventing proofs without loading React Native.
 * The prior path Unicode-trimmed line-item `catalog_object_id` through shared
 * `stringField` before storing it on ingested sale rows
 * (`'\u2003var-1\u2003'.trim() === 'var-1'`), so NBSP/em-space padding
 * invented a clean provider variation identity used for POS sale matching,
 * verified recipe mapping, and inventory planning. Soft-empty Unicode-only
 * padding also collapsed through `.trim()` into the intentional empty →
 * `undefined` drop.
 *
 * These are Square order-normalization **provider variation** tokens only —
 * not Square order-sale `provider_location_id` (#938 / MISE-005SZ), not hosted
 * verified-provider mapping `providerLocationId` hydrate (#936 / MISE-005SX),
 * not Square catalog/location list `id` / `externalLocationId` stringField
 * paths, not order `id` / `source_record_id`, not sale `item_name`, not
 * catalog variation list `id` → `external_variation_id`, and not repository
 * Square integration error haystacks (#929 / MISE-005SQ). Soft empty /
 * Unicode-padded / overlong / control-bearing tokens soft-null so padded
 * variation IDs cannot invent durable sale-row variation identity. Ordinary
 * ASCII whitespace still trims clean. Case and accents are left unchanged.
 *
 * Complements open Square order-sale location tip #938 / MISE-005SZ without
 * sharing that module or rewriting sibling `stringField` call sites.
 * Leave shared `stringField` itself and other normalizeOrderSales fields
 * alone for separate tips.
 */

const MAX_SQUARE_ORDER_SALE_PROVIDER_VARIATION_ID = 128;

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized provider variation identity before it is
 * stored on durable `SquareSaleRow.provider_variation_id`.
 */
export function asciiTrimSquareOrderSaleProviderVariationId(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Square order-sale provider variation id under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded,
 * overlong, or containing ASCII controls.
 */
export function canonicalizeSquareOrderSaleProviderVariationId(
  value: string
): string | null {
  const trimmed = asciiTrimSquareOrderSaleProviderVariationId(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (trimmed.length > MAX_SQUARE_ORDER_SALE_PROVIDER_VARIATION_ID) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Square `normalizeOrderSales` `catalog_object_id` →
 * `provider_variation_id`. Preserves soft empty → null (prior `stringField`
 * emptiness → `|| undefined` drop) while refusing to invent a clean
 * variation id via Unicode em-space trim. Does not throw; Unicode-padded /
 * unsafe / non-string tokens return null so the live
 * `variationId || undefined` branch owns the drop.
 */
export function normalizeSquareOrderSaleProviderVariationId(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those into the intentional empty variation drop. Do not invent
  // a provider variation id from padding.
  if (!value.trim()) return null;
  return canonicalizeSquareOrderSaleProviderVariationId(value);
}
