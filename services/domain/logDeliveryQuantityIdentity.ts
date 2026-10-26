/**
 * Log Delivery quantity draft helpers (MISE-005RE).
 *
 * Pins `app/more/log-delivery.tsx` `quantityText` prep outside the React Native
 * screen graph so Node tests can exercise inventing proofs without loading
 * Expo. The prior path fed `quantityText` into locale `parseNumber`
 * (`parseLocalizedNumber`), which Unicode-trims before parsing
 * (`'\u200312\u2003'.trim() === '12'`), so NBSP / em-space padding invented a
 * clean receipt quantity the operator did not type as ordinary ASCII digits.
 * Unicode-only space also invented the empty / invalid-quantity branch via
 * `'\u2003'.trim() === ''`.
 *
 * These are single-line receipt-quantity drafts used only for the Log Delivery
 * submit path, not free-form multiline delivery notes (open #886 / MISE-005QZ),
 * not inventory count `draftCounts` (open #890 / MISE-005RD), not Orders
 * recommendation quantity drafts (open #889 / MISE-005RC), and not inventory
 * detail operation quantities (`app/inventory/[id].tsx`). Soft empty (ASCII
 * whitespace or Unicode-only space) stays `empty` so callers keep the prior
 * `parseNumber` emptiness → quantity-error contract. Ordinary ASCII whitespace
 * still trims clean before locale `parseNumber`. Unicode-padded or
 * control-bearing drafts fail closed as `invalid` so padded `"12"` cannot
 * invent a received quantity.
 *
 * Complements open Log Delivery note tip #886 / MISE-005QZ, Orders
 * recommendation quantity tip #889 / MISE-005RC, and inventory count quantity
 * tip #890 / MISE-005RD without sharing those modules. Locale parsing stays on
 * the screen via `parseNumber`; this module only refuses to invent a clean
 * draft string.
 */

export type LogDeliveryQuantityPrep =
  | { status: "empty" }
  | { status: "ok"; text: string }
  | { status: "invalid" };

/**
 * ASCII-only end trim; Unicode `String#trim` / `parseLocalizedNumber` TrimString
 * would strip NBSP / em-space padding and invent a normalized receipt quantity
 * before submit.
 */
export function asciiTrimLogDeliveryQuantityText(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Log Delivery quantity draft under ASCII C.
 * Returns `empty` when blank after ASCII trim, `invalid` when still
 * Unicode-padded / control-bearing, otherwise `ok` with the ASCII-trimmed
 * text for locale `parseNumber`.
 */
export function canonicalizeLogDeliveryQuantityText(value: string): LogDeliveryQuantityPrep {
  const trimmed = asciiTrimLogDeliveryQuantityText(value);
  if (!trimmed) return { status: "empty" };
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return { status: "invalid" };
  if (hasControlCharacters(trimmed)) return { status: "invalid" };
  return { status: "ok", text: trimmed };
}

/**
 * Soft normalize for Log Delivery receipt quantity submit.
 * Preserves soft empty → `empty` (prior `parseNumber` emptiness → quantity
 * error) while refusing to invent a clean draft via Unicode em-space / NBSP
 * trim. Non-string and control-bearing / padded tokens are `invalid`.
 */
export function prepareLogDeliveryQuantityText(value: unknown): LogDeliveryQuantityPrep {
  if (typeof value !== "string") return { status: "invalid" };
  if (value === "") return { status: "empty" };
  // Soft empty for Unicode-only space (em-space alone): prior
  // `parseLocalizedNumber` emptied those into the quantity-error branch.
  if (!value.trim()) return { status: "empty" };
  return canonicalizeLogDeliveryQuantityText(value);
}
