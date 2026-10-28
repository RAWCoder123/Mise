/**
 * Square order-sale source-record order-id identity helpers (MISE-005TB).
 *
 * Pins Edge `normalizeOrderSales` order `id` → durable
 * `SquareSaleRow.source_record_id` composition outside the Expo UI graph so
 * Node tests can exercise inventing proofs without loading React Native.
 * The prior path Unicode-trimmed order `id` through shared `stringField`
 * before composing `square_${orderId}_${uid}`
 * (`'\u2003order-1\u2003'.trim() === 'order-1'`), so NBSP/em-space padding
 * invented a clean order identity inside the durable sale source-record id
 * used for POS sale idempotency and inventory planning. Soft-empty
 * Unicode-only padding also collapsed through `.trim()` into the intentional
 * empty → drop-all-sales branch.
 *
 * These are Square order-normalization **source-record order id** tokens
 * only — not Square order-sale `provider_location_id` (#938 / MISE-005SZ),
 * not Square order-sale `provider_variation_id` (#939 / MISE-005TA), not
 * hosted verified-provider mapping `providerLocationId` hydrate
 * (#936 / MISE-005SX), not Square catalog/location list `id` /
 * `externalLocationId` stringField paths, not sale `item_name`, not line
 * `uid`, not catalog variation list `id` → `external_variation_id`, and not
 * repository Square integration error haystacks (#929 / MISE-005SQ). Soft
 * empty / Unicode-padded / overlong / control-bearing tokens soft-null so
 * padded order IDs cannot invent durable `source_record_id` composition.
 * Ordinary ASCII whitespace still trims clean. Case and accents are left
 * unchanged.
 *
 * Complements open Square order-sale location tip #938 / MISE-005SZ and
 * variation tip #939 / MISE-005TA without sharing those modules or rewriting
 * sibling `stringField` call sites. Leave shared `stringField` itself and
 * other normalizeOrderSales fields alone for separate tips.
 */

const MAX_SQUARE_ORDER_SALE_SOURCE_RECORD_ORDER_ID = 128;

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized order identity before it is composed into
 * durable `SquareSaleRow.source_record_id`.
 */
export function asciiTrimSquareOrderSaleSourceRecordOrderId(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Square order-sale source-record order id under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded,
 * overlong, or containing ASCII controls.
 */
export function canonicalizeSquareOrderSaleSourceRecordOrderId(
  value: string
): string | null {
  const trimmed = asciiTrimSquareOrderSaleSourceRecordOrderId(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (trimmed.length > MAX_SQUARE_ORDER_SALE_SOURCE_RECORD_ORDER_ID) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Square `normalizeOrderSales` order `id` →
 * `source_record_id` composition. Preserves soft empty → null (prior
 * `stringField` emptiness → drop-all-sales branch) while refusing to invent
 * a clean order id via Unicode em-space trim. Does not throw; Unicode-padded /
 * unsafe / non-string tokens return null so the live `if (!orderId) return []`
 * branch owns the drop.
 */
export function normalizeSquareOrderSaleSourceRecordOrderId(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those into the intentional empty order drop. Do not invent
  // an order id from padding.
  if (!value.trim()) return null;
  return canonicalizeSquareOrderSaleSourceRecordOrderId(value);
}
