/**
 * Orders review recommendation quantity draft helpers (MISE-005RC).
 *
 * Pins `app/(tabs)/orders.tsx` approve-path quantity draft prep outside the
 * React Native screen graph so Node tests can exercise inventing proofs
 * without loading Expo. The prior path Unicode-trimmed
 * `quantities[recommendation.id]` before emptiness and locale `parseNumber`
 * (`'\u200312\u2003'.trim() === '12'`), so NBSP / em-space padding invented a
 * clean purchase quantity the operator did not type as ordinary ASCII digits.
 * Unicode-only space also invented the empty branch via `'\u2003'.trim() === ''`.
 *
 * These are single-line purchase-unit quantity drafts used only for the Orders
 * review approve path, not free-form multiline prose, not Log Delivery quantity
 * (`app/more/log-delivery.tsx`), not inventory count `draftCounts`
 * (`app/inventory/count.tsx`), and not Autonomy spend-limit drafts (#888 /
 * MISE-005RB). Soft empty (ASCII whitespace or Unicode-only space) stays
 * `empty` so callers keep the prior `.trim()` emptiness → quantity-range
 * validation contract. Ordinary ASCII whitespace still trims clean before
 * locale `parseNumber`. Unicode-padded or control-bearing drafts fail closed
 * as `invalid` so padded `"12"` cannot invent an approved quantity.
 *
 * Complements open orderPresentation line tip #887 / MISE-005RA and autonomy
 * spend-limit tip #888 / MISE-005RB without sharing those modules. Locale
 * parsing stays on the screen via `parseNumber`; this module only refuses to
 * invent a clean draft string.
 */

export type OrdersRecommendationQuantityPrep =
  | { status: "empty" }
  | { status: "ok"; text: string }
  | { status: "invalid" };

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized quantity draft before approve.
 */
export function asciiTrimOrdersRecommendationQuantityText(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an Orders recommendation quantity draft under ASCII C.
 * Returns `empty` when blank after ASCII trim, `invalid` when still
 * Unicode-padded / control-bearing, otherwise `ok` with the ASCII-trimmed
 * text for locale `parseNumber`.
 */
export function canonicalizeOrdersRecommendationQuantityText(
  value: string
): OrdersRecommendationQuantityPrep {
  const trimmed = asciiTrimOrdersRecommendationQuantityText(value);
  if (!trimmed) return { status: "empty" };
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return { status: "invalid" };
  if (hasControlCharacters(trimmed)) return { status: "invalid" };
  return { status: "ok", text: trimmed };
}

/**
 * Soft normalize for Orders review recommendation quantity approve.
 * Preserves soft empty → `empty` (prior `.trim()` emptiness → quantity-range
 * error) while refusing to invent a clean draft via Unicode em-space / NBSP
 * trim. Non-string and control-bearing / padded tokens are `invalid`.
 */
export function prepareOrdersRecommendationQuantityText(
  value: unknown
): OrdersRecommendationQuantityPrep {
  if (typeof value !== "string") return { status: "invalid" };
  if (value === "") return { status: "empty" };
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those into the quantity-range validation branch.
  if (!value.trim()) return { status: "empty" };
  return canonicalizeOrdersRecommendationQuantityText(value);
}
