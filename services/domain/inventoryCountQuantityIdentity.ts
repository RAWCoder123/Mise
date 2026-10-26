/**
 * Inventory count-sheet quantity draft helpers (MISE-005RD).
 *
 * Pins `app/inventory/count.tsx` `draftCounts` prep outside the React Native
 * screen graph so Node tests can exercise inventing proofs without loading
 * Expo. The prior path Unicode-trimmed
 * `draftCounts[line.inventory_item_id]` before emptiness and ECMAScript
 * `Number` (`'\u200312\u2003'.trim() === '12'` / `Number('\u200312\u2003') === 12`),
 * so NBSP / em-space padding invented a clean counted quantity the operator
 * did not type as ordinary ASCII digits. Unicode-only space also invented the
 * empty / skip-line branch via `'\u2003'.trim() === ''`.
 *
 * These are single-line counted-quantity drafts used only for the inventory
 * count-sheet save/submit and live variance display paths, not free-form
 * multiline variance notes (open #885 / MISE-005QY), not Log Delivery
 * `quantityText` (`app/more/log-delivery.tsx`), and not Orders recommendation
 * quantity drafts (open #889 / MISE-005RC). Soft empty (ASCII whitespace or
 * Unicode-only space) stays `empty` so callers keep the prior `.trim()`
 * emptiness → skip-line contract. Ordinary ASCII whitespace still trims clean
 * before `Number`. Unicode-padded, control-bearing, or non-finite drafts fail
 * closed as `invalid` so padded `"12"` cannot invent a counted quantity.
 *
 * Complements open count-sheet note tip #885 / MISE-005QY and Orders
 * recommendation quantity tip #889 / MISE-005RC without sharing those modules.
 */

export type InventoryCountQuantityPrep =
  | { status: "empty" }
  | { status: "ok"; quantity: number; text: string }
  | { status: "invalid" };

/**
 * ASCII-only end trim; Unicode `String#trim` / ECMAScript `Number` TrimString
 * would strip NBSP / em-space padding and invent a normalized counted quantity
 * before save/submit.
 */
export function asciiTrimInventoryCountQuantityText(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an inventory count quantity draft under ASCII C.
 * Returns `empty` when blank after ASCII trim, `invalid` when still
 * Unicode-padded / control-bearing / non-finite, otherwise `ok` with the
 * ASCII-trimmed text and finite `Number` quantity.
 */
export function canonicalizeInventoryCountQuantityText(
  value: string
): InventoryCountQuantityPrep {
  const trimmed = asciiTrimInventoryCountQuantityText(value);
  if (!trimmed) return { status: "empty" };
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return { status: "invalid" };
  if (hasControlCharacters(trimmed)) return { status: "invalid" };
  const quantity = Number(trimmed);
  if (!Number.isFinite(quantity)) return { status: "invalid" };
  return { status: "ok", quantity, text: trimmed };
}

/**
 * Soft normalize for inventory count-sheet quantity drafts.
 * Preserves soft empty → `empty` (prior `.trim()` emptiness → skip line)
 * while refusing to invent a clean quantity via Unicode em-space / NBSP trim
 * or `Number` TrimString. Non-string and control-bearing / padded / malformed
 * tokens are `invalid`.
 */
export function prepareInventoryCountQuantityText(
  value: unknown
): InventoryCountQuantityPrep {
  if (typeof value !== "string") return { status: "invalid" };
  if (value === "") return { status: "empty" };
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those into the skip-line branch.
  if (!value.trim()) return { status: "empty" };
  return canonicalizeInventoryCountQuantityText(value);
}
