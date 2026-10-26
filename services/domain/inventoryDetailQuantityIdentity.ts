/**
 * Inventory detail operation quantity draft helpers (MISE-005RF).
 *
 * Pins `app/inventory/[id].tsx` `quantityText` prep outside the React Native
 * screen graph so Node tests can exercise inventing proofs without loading
 * Expo. The prior path fed `quantityText` into `validateOperationQuantity`
 * (`value.trim()` emptiness) and locale `parseNumber` (`parseLocalizedNumber`),
 * which Unicode-trims before parsing (`'\u200312\u2003'.trim() === '12'`), so
 * NBSP / em-space padding invented a clean operation quantity the operator did
 * not type as ordinary ASCII digits. Unicode-only space also invented the
 * required-field branch via `'\u2003'.trim() === ''`.
 *
 * These are single-line inventory-operation quantity drafts used only for the
 * inventory detail count / receipt / waste submit path, not free-form multiline
 * operation notes (open #854 / MISE-005PT), not Log Delivery notes (open #886 /
 * MISE-005QZ), not Log Delivery quantities (open #891 / MISE-005RE), not
 * inventory count `draftCounts` (open #890 / MISE-005RD), not Orders
 * recommendation quantity drafts (open #889 / MISE-005RC), and not inventory
 * detail settings fields (`parLevel` / `reorderThreshold`). Soft empty (ASCII
 * whitespace or Unicode-only space) stays `empty` so callers keep the prior
 * `value.trim()` emptiness → field-required contract. Ordinary ASCII whitespace
 * still trims clean before locale `parseNumber`. Unicode-padded or
 * control-bearing drafts fail closed as `invalid` so padded `"12"` cannot
 * invent a counted, received, or wasted quantity.
 *
 * Complements open inventory-operation note tip #854 / MISE-005PT, Log Delivery
 * quantity tip #891 / MISE-005RE, inventory count quantity tip #890 /
 * MISE-005RD, and Orders recommendation quantity tip #889 / MISE-005RC without
 * sharing those modules. Locale parsing stays on the screen via `parseNumber`;
 * this module only refuses to invent a clean draft string.
 */

export type InventoryDetailQuantityPrep =
  | { status: "empty" }
  | { status: "ok"; text: string }
  | { status: "invalid" };

/**
 * ASCII-only end trim; Unicode `String#trim` / `parseLocalizedNumber` TrimString
 * would strip NBSP / em-space padding and invent a normalized operation
 * quantity before submit.
 */
export function asciiTrimInventoryDetailQuantityText(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an inventory detail operation quantity draft under ASCII C.
 * Returns `empty` when blank after ASCII trim, `invalid` when still
 * Unicode-padded / control-bearing, otherwise `ok` with the ASCII-trimmed
 * text for locale `parseNumber`.
 */
export function canonicalizeInventoryDetailQuantityText(
  value: string
): InventoryDetailQuantityPrep {
  const trimmed = asciiTrimInventoryDetailQuantityText(value);
  if (!trimmed) return { status: "empty" };
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return { status: "invalid" };
  if (hasControlCharacters(trimmed)) return { status: "invalid" };
  return { status: "ok", text: trimmed };
}

/**
 * Soft normalize for inventory detail operation quantity submit.
 * Preserves soft empty → `empty` (prior `value.trim()` emptiness → field
 * required) while refusing to invent a clean draft via Unicode em-space / NBSP
 * trim. Non-string and control-bearing / padded tokens are `invalid`.
 */
export function prepareInventoryDetailQuantityText(
  value: unknown
): InventoryDetailQuantityPrep {
  if (typeof value !== "string") return { status: "invalid" };
  if (value === "") return { status: "empty" };
  // Soft empty for Unicode-only space (em-space alone): prior
  // `validateOperationQuantity` / `parseLocalizedNumber` emptied those into the
  // field-required / quantity-error branch.
  if (!value.trim()) return { status: "empty" };
  return canonicalizeInventoryDetailQuantityText(value);
}
