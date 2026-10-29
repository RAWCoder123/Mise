/**
 * Square order-sale variation-name identity helpers (MISE-005TL).
 *
 * Pins Edge `normalizeOrderSales` line-item `variation_name` → durable
 * `SquareSaleRow.category` (when no `catalog_object_id` is present) outside
 * the Expo UI graph so Node tests can exercise inventing proofs without
 * loading React Native. The prior path Unicode-trimmed line-item
 * `variation_name` through shared `stringField` before storing `category`
 * (and falling back to `"Square"` on soft empty)
 * (`'\u2003Large\u2003'.trim() === 'Large'`), so NBSP/em-space padding
 * invented a clean sale category label used for POS sale presentation,
 * Insights category aggregation, and inventory planning surfaces.
 * Soft-empty Unicode-only padding also collapsed through `.trim()` into the
 * intentional `"Square"` fallback.
 *
 * These are Square order-normalization **sale line category-from-
 * variation_name** tokens only — not Square order-sale line-item `name` →
 * `item_name` (#941 / MISE-005TC), not Square order-sale `source_record_id`
 * order id (#940 / MISE-005TB), not Square order-sale line `uid` (#942 /
 * MISE-005TD), not Square order-sale `provider_variation_id` /
 * `catalog_object_id` (#939 / MISE-005TA), not Square order-sale
 * `provider_location_id` (#938 / MISE-005SZ), not Square catalog variation
 * `name` (#948 / MISE-005TJ), not Square catalog item `name` /
 * `external_name` (#947 / MISE-005TI), not Ask Mise sales top-item labels
 * (#937 / MISE-005SY), and not repository Square integration error
 * haystacks (#929 / MISE-005SQ). Soft empty / Unicode-padded / overlong /
 * control-bearing tokens soft-null so padded variation names cannot invent
 * a clean durable `category`. Ordinary ASCII whitespace still trims clean.
 * Case and accents are left unchanged. The live `|| "Square"` fallback owns
 * soft-empty and fail-closed paths without inventing a clean operator-facing
 * category label from padding.
 *
 * Complements open Square order-sale tips #942 / MISE-005TD, #941 /
 * MISE-005TC, #940 / MISE-005TB, #939 / MISE-005TA, and #938 / MISE-005SZ
 * without sharing those modules or rewriting sibling `stringField` call
 * sites. Leave shared `stringField` itself and other normalizeOrderSales
 * fields (order `id`, location_id, catalog_object_id, uid, name,
 * closed_at/created_at) alone for separate tips. Leave `normalizeCatalogItem`
 * product_type / category_id / variation names alone for separate tips.
 */

const MAX_SQUARE_ORDER_SALE_VARIATION_NAME = 80;

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized sale variation name before it is stored on
 * durable `SquareSaleRow.category`.
 */
export function asciiTrimSquareOrderSaleVariationName(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Square order-sale variation name under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded,
 * overlong, or containing ASCII controls.
 */
export function canonicalizeSquareOrderSaleVariationName(
  value: string
): string | null {
  const trimmed = asciiTrimSquareOrderSaleVariationName(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (trimmed.length > MAX_SQUARE_ORDER_SALE_VARIATION_NAME) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Square `normalizeOrderSales` line-item `variation_name`
 * → `category` (category-fallback path when `catalog_object_id` is absent).
 * Preserves soft empty → null (prior `stringField` emptiness → `"Square"`
 * fallback) while refusing to invent a clean category label via Unicode
 * em-space trim. Does not throw; Unicode-padded / unsafe / non-string tokens
 * return null so the live `|| "Square"` branch owns the fail-closed fallback
 * without inventing a clean durable category.
 */
export function normalizeSquareOrderSaleVariationName(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those into the intentional `"Square"` fallback. Do not invent a
  // clean sale category from padding.
  if (!value.trim()) return null;
  return canonicalizeSquareOrderSaleVariationName(value);
}
