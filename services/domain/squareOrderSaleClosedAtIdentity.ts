/**
 * Square order-sale closed-at / created-at identity helpers (MISE-005TM).
 *
 * Pins Edge `normalizeOrderSales` order `closed_at` (with `created_at`
 * fallback) → durable `SquareSaleRow.sale_date` outside the Expo UI graph so
 * Node tests can exercise inventing proofs without loading React Native.
 * The prior path Unicode-trimmed `closed_at` / `created_at` through shared
 * `stringField` before slicing `closedAt.slice(0, 10)` into `sale_date`
 * (`'\u20032026-07-30T12:00:00.000Z\u2003'.trim() === '2026-07-30T12:00:00.000Z'`),
 * so NBSP/em-space padding invented a clean sale date used for POS sale
 * day grouping, Insights sales aggregation, inventory planning, and
 * historical service-day selection. Soft-empty Unicode-only padding also
 * collapsed through `.trim()` into the intentional
 * `new Date().toISOString()` fallback.
 *
 * These are Square order-normalization **sale timestamp → sale_date** tokens
 * only — not Square order-sale line-item `name` → `item_name`
 * (#941 / MISE-005TC), not Square order-sale `source_record_id` order id
 * (#940 / MISE-005TB), not Square order-sale line `uid` (#942 / MISE-005TD),
 * not Square order-sale `provider_variation_id` / `catalog_object_id`
 * (#939 / MISE-005TA), not Square order-sale `provider_location_id`
 * (#938 / MISE-005SZ), not Square order-sale `variation_name` category
 * (#950 / MISE-005TL), not Square catalog / location list identities, and
 * not repository Square integration error haystacks (#929 / MISE-005SQ). Soft
 * empty / Unicode-padded / overlong / control-bearing tokens soft-null so
 * padded timestamps cannot invent a clean durable `sale_date`. Ordinary
 * ASCII whitespace still trims clean. Case and accents are left unchanged.
 * The live `|| new Date().toISOString()` fallback owns soft-empty and
 * fail-closed paths without inventing a clean operator-facing sale date
 * from padding.
 *
 * Complements open Square order-sale tips #950 / MISE-005TL, #942 /
 * MISE-005TD, #941 / MISE-005TC, #940 / MISE-005TB, #939 / MISE-005TA, and
 * #938 / MISE-005SZ without sharing those modules or rewriting sibling
 * `stringField` call sites. Leave shared `stringField` itself and other
 * normalizeOrderSales fields (order `id`, location_id, catalog_object_id,
 * uid, name, variation_name) alone for separate tips. Leave
 * `normalizeCatalogItem` product_type / category_id / variation names alone
 * for separate tips. OAuth `expires_at` is a separate tip surface.
 */

const MAX_SQUARE_ORDER_SALE_CLOSED_AT = 64;

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized sale timestamp before it is sliced into
 * durable `SquareSaleRow.sale_date`.
 */
export function asciiTrimSquareOrderSaleClosedAt(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Square order-sale closed_at / created_at timestamp under
 * ASCII C. Returns null when empty after ASCII trim, still Unicode-padded,
 * overlong, or containing ASCII controls.
 */
export function canonicalizeSquareOrderSaleClosedAt(
  value: string
): string | null {
  const trimmed = asciiTrimSquareOrderSaleClosedAt(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (trimmed.length > MAX_SQUARE_ORDER_SALE_CLOSED_AT) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Square `normalizeOrderSales` order `closed_at` /
 * `created_at` → `sale_date`. Preserves soft empty → null (prior
 * `stringField` emptiness → `new Date().toISOString()` fallback) while
 * refusing to invent a clean timestamp via Unicode em-space trim. Does not
 * throw; Unicode-padded / unsafe / non-string tokens return null so the live
 * `|| new Date().toISOString()` branch owns the fail-closed fallback without
 * inventing a clean durable sale date from padding. The same helper covers
 * both `closed_at` (primary) and `created_at` (fallback) because both feed
 * the same durable `sale_date` field through the same prior `stringField`
 * inventing path.
 */
export function normalizeSquareOrderSaleClosedAt(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those into the intentional `new Date().toISOString()` fallback.
  // Do not invent a clean sale timestamp from padding.
  if (!value.trim()) return null;
  return canonicalizeSquareOrderSaleClosedAt(value);
}
