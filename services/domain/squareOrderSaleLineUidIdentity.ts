/**
 * Square order-sale line-uid identity helpers (MISE-005TD).
 *
 * Pins Edge `normalizeOrderSales` line-item `uid` → durable
 * `SquareSaleRow.source_record_id` composition outside the Expo UI graph so
 * Node tests can exercise inventing proofs without loading React Native.
 * The prior path Unicode-trimmed line `uid` through shared `stringField`
 * before composing `square_${orderId}_${uid}`
 * (`'\u2003line-1\u2003'.trim() === 'line-1'`), so NBSP/em-space padding
 * invented a clean line identity inside the durable sale source-record id
 * used for POS sale idempotency and inventory planning. Soft-empty
 * Unicode-only padding also collapsed through `.trim()` into the intentional
 * empty → `String(index)` fallback.
 *
 * These are Square order-normalization **sale line uid** tokens only — not
 * Square order-sale `source_record_id` order id (#940 / MISE-005TB), not
 * Square order-sale line-item `name` → `item_name` (#941 / MISE-005TC), not
 * Square order-sale `provider_variation_id` (#939 / MISE-005TA), not Square
 * order-sale `provider_location_id` (#938 / MISE-005SZ), not hosted
 * verified-provider mapping `providerLocationId` hydrate (#936 / MISE-005SX),
 * not Ask Mise sales top-item labels (#937 / MISE-005SY), not Square catalog
 * item `name` / `external_name` stringField paths, not catalog variation list
 * `id` → `external_variation_id`, and not repository Square integration
 * error haystacks (#929 / MISE-005SQ). Soft empty / Unicode-padded /
 * overlong / control-bearing tokens soft-null so padded line UIDs cannot
 * invent durable `source_record_id` composition. Ordinary ASCII whitespace
 * still trims clean. Case and accents are left unchanged. The live
 * `?? String(index)` fallback owns soft-empty and fail-closed paths without
 * inventing a clean line uid from padding.
 *
 * Complements open Square order-sale tips #941 / MISE-005TC, #940 / MISE-005TB,
 * #939 / MISE-005TA, and #938 / MISE-005SZ without sharing those modules or
 * rewriting sibling `stringField` call sites. Leave shared `stringField`
 * itself and other normalizeOrderSales fields alone for separate tips.
 */

const MAX_SQUARE_ORDER_SALE_LINE_UID = 128;

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized line uid before it is composed into
 * durable `SquareSaleRow.source_record_id`.
 */
export function asciiTrimSquareOrderSaleLineUid(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Square order-sale line uid under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded,
 * overlong, or containing ASCII controls.
 */
export function canonicalizeSquareOrderSaleLineUid(value: string): string | null {
  const trimmed = asciiTrimSquareOrderSaleLineUid(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (trimmed.length > MAX_SQUARE_ORDER_SALE_LINE_UID) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Square `normalizeOrderSales` line-item `uid` →
 * `source_record_id` composition. Preserves soft empty → null (prior
 * `stringField` emptiness → `String(index)` fallback) while refusing to
 * invent a clean line uid via Unicode em-space trim. Does not throw;
 * Unicode-padded / unsafe / non-string tokens return null so the live
 * `?? String(index)` branch owns the fail-closed fallback without inventing
 * a clean durable line identity.
 */
export function normalizeSquareOrderSaleLineUid(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those into the intentional index fallback. Do not invent a
  // line uid from padding.
  if (!value.trim()) return null;
  return canonicalizeSquareOrderSaleLineUid(value);
}
