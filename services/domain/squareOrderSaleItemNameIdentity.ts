/**
 * Square order-sale item-name identity helpers (MISE-005TC).
 *
 * Pins Edge `normalizeOrderSales` line-item `name` → durable
 * `SquareSaleRow.item_name` outside the Expo UI graph so Node tests can
 * exercise inventing proofs without loading React Native. The prior path
 * Unicode-trimmed line-item `name` through shared `stringField` before
 * storing `item_name` (and falling back to `"Untitled item"` on soft empty)
 * (`'\u2003Burger\u2003'.trim() === 'Burger'`), so NBSP/em-space padding
 * invented a clean sale item label used for POS sale presentation, recipe
 * mapping lookup surfaces, and inventory planning. Soft-empty Unicode-only
 * padding also collapsed through `.trim()` into the intentional
 * `"Untitled item"` fallback.
 *
 * These are Square order-normalization **sale line item_name** tokens only —
 * not Square order-sale `source_record_id` order id (#940 / MISE-005TB), not
 * Square order-sale `provider_variation_id` (#939 / MISE-005TA), not Square
 * order-sale `provider_location_id` (#938 / MISE-005SZ), not hosted
 * verified-provider mapping `providerLocationId` hydrate (#936 / MISE-005SX),
 * not Ask Mise sales top-item labels (#937 / MISE-005SY), not Square catalog
 * item `name` / `external_name` stringField paths, not line `uid`, not catalog
 * variation list `id` → `external_variation_id`, and not repository Square
 * integration error haystacks (#929 / MISE-005SQ). Soft empty /
 * Unicode-padded / overlong / control-bearing tokens soft-null so padded
 * names cannot invent a clean durable `item_name`. Ordinary ASCII whitespace
 * still trims clean. Case and accents are left unchanged. The live
 * `?? "Untitled item"` fallback owns soft-empty and fail-closed paths
 * without inventing a clean operator-facing item label from padding.
 *
 * Complements open Square order-sale tips #940 / MISE-005TB, #939 / MISE-005TA,
 * and #938 / MISE-005SZ without sharing those modules or rewriting sibling
 * `stringField` call sites. Leave shared `stringField` itself and other
 * normalizeOrderSales fields alone for separate tips. Leave
 * `normalizeCatalogItem` item/variation names alone for separate tips.
 */

const MAX_SQUARE_ORDER_SALE_ITEM_NAME = 160;

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized sale item name before it is stored on
 * durable `SquareSaleRow.item_name`.
 */
export function asciiTrimSquareOrderSaleItemName(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Square order-sale item name under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded,
 * overlong, or containing ASCII controls.
 */
export function canonicalizeSquareOrderSaleItemName(value: string): string | null {
  const trimmed = asciiTrimSquareOrderSaleItemName(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (trimmed.length > MAX_SQUARE_ORDER_SALE_ITEM_NAME) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Square `normalizeOrderSales` line-item `name` →
 * `item_name`. Preserves soft empty → null (prior `stringField` emptiness →
 * `"Untitled item"` fallback) while refusing to invent a clean item label via
 * Unicode em-space trim. Does not throw; Unicode-padded / unsafe / non-string
 * tokens return null so the live `?? "Untitled item"` branch owns the
 * fail-closed fallback without inventing a clean durable name.
 */
export function normalizeSquareOrderSaleItemName(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those into the intentional `"Untitled item"` fallback. Do not
  // invent a clean sale item name from padding.
  if (!value.trim()) return null;
  return canonicalizeSquareOrderSaleItemName(value);
}
