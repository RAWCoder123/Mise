/**
 * Orders detail Screen title `orders.detail.title` supplier_name display
 * helpers (MISE-005VH).
 *
 * Pins the Orders detail Screen title that previously selected display text
 * with nullish coalescing before the intentional localized fallback:
 * `visibleOrder?.supplier_name ?? t("orders.detail.title")`.
 *
 * A Unicode-only-space supplier name (`"\u2003"`) is non-nullish
 * (`("\u2003" ?? FALLBACK) === "\u2003"`), so the intentional
 * `orders.detail.title` copy was bypassed and the Screen could render a
 * blank-looking title. Empty string has the same `??` bypass
 * (`("" ?? FALLBACK) === ""`). Separately, Unicode `.trim()` on padded
 * supplier names (`"\u2003Acme Foods\u2003".trim() === "Acme Foods"`) would
 * invent a clean display title if that gate Unicode-trimmed before
 * interpolation.
 *
 * Single-line supplier-name title tips use ASCII end trim only and preserve
 * NBSP (no fold into plain space). Soft-null when Unicode trim would still
 * strip end padding (NBSP / em-space) so padding cannot invent equality with
 * an unpadded supplier name. Accents and case are preserved. Full C0/DEL
 * control rejection applies (no LF/TAB/CR allowlist); multiline free-text
 * note/body display stays on open #1013 / #1014 / #840.
 *
 * These are presentation **orders.detail.title** supplier_name Screen title
 * tokens only — not email-review From/To/Subject headers (#1015), not
 * email-review body (#1014), not sent-note `orders.detail.note.none` (#1013),
 * not supplier operator_note write/persist (#840), not `generatedOrderMessage`
 * display trim, not durable demo supplier-send From/To (#708), not durable
 * demo supplier-send subject (#913), not Orders delivery-evidence timezone
 * (#1010), not receive-discrepancy (#670), not inventory detail
 * `item_name ??` (#candidate), not waste `itemName ??` (#candidate), and not
 * Settings/Gmail `sender_email ??` (#candidate). Soft empty /
 * Unicode-padded / control-bearing tokens soft-null so the live
 * `|| t("orders.detail.title")` branch owns the intentional localized
 * fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1015 / #1014 / #1013 / #840 / #1010 / #670 / #708 / #913
 * on Orders paths without sharing those modules or rewriting their call
 * sites. Other `visibleOrder.supplier_name` interpolations in the same
 * screen (action a11y / receive copy) are left alone — they do not use the
 * `?? t("orders.detail.title")` inventing / bypass path.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized supplier-name Screen title before it is
 * rendered into the Orders detail header.
 */
export function asciiTrimOrdersDetailTitleSupplierName(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an Orders detail Screen title supplier_name under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeOrdersDetailTitleSupplierName(
  value: string
): string | null {
  const trimmed = asciiTrimOrdersDetailTitleSupplierName(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize one Orders detail Screen title supplier_name candidate.
 * Preserves soft empty → null (intentional localized orders.detail.title
 * copy) while refusing to invent a clean supplier name via Unicode em-space /
 * NBSP trim. Does not throw; Unicode-padded / unsafe / non-string tokens
 * return null so the live `|| t("orders.detail.title")` branch owns the
 * fallback without inventing a clean title identity from padding, and without
 * letting non-nullish Unicode-only space or empty string bypass that fallback
 * through the prior `??` row.
 */
export function normalizeOrdersDetailTitleSupplierName(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously bypassed the intentional localized orders.detail.title copy via
  // `??`. Do not invent a clean Screen title from padding.
  if (!value.trim()) return null;
  return canonicalizeOrdersDetailTitleSupplierName(value);
}
