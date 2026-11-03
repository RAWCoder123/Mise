/**
 * Orders detail action a11y supplier_name identity helpers (MISE-005XH).
 *
 * Pins Orders detail action accessibility interpolations that previously
 * always passed raw `visibleOrder.supplier_name` into copy / simulate /
 * approve-and-send / mark-received labels:
 * `t("orders.detail.action.copyAccessibility", { supplier: visibleOrder.supplier_name })`
 * (and the parallel simulate / approveAndSend / markReceived keys).
 *
 * A Unicode-only-space supplier name (`"\u2003"`) is non-nullish and still
 * interpolated into those a11y strings, so blank-looking supplier identity
 * appeared in VoiceOver / TalkBack labels with no intentional localized
 * fallback. Empty string has the same blank-name bypass. Separately,
 * Unicode `.trim()` on a padded supplier name
 * (`"\u2003Sysco\u2003".trim() === "Sysco"`) would invent a clean display
 * supplier identity if that gate Unicode-trimmed before interpolating into
 * the Orders detail action a11y chrome.
 *
 * Single-line supplier-name tips use ASCII end trim only and preserve NBSP
 * (no fold into plain space). Soft-null when Unicode trim would still strip
 * end padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded supplier name. Accents and case are preserved. Full C0/DEL
 * control rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **orders.detail.action.supplier.none** supplier-name
 * tokens only — the Orders detail action a11y `supplier` interpolations that
 * fall through to that fallback when soft-null. Not Orders detail Screen
 * title supplier_name (#1016 / MISE-005VH), not SupplierDraftCard
 * supplier_name (#1050 / MISE-005WP), not Orders review recommendation
 * supplier_name (#1051 / MISE-005WQ), not email-review From/To/Subject
 * (#1015), not email-review body (#1014), not note.none (#1013), not
 * operator_note (#840), not durable send From/To (#708), not durable send
 * subject (#913), not delivery-evidence (#1010), not receive-discrepancy
 * (#670), and not the approveAndSend `recipient` interpolation. Soft empty /
 * Unicode-padded / control-bearing tokens soft-null so the live
 * `|| t("orders.detail.action.supplier.none")` branch owns the intentional
 * localized fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1016 / #1050 / #1051 / #1015 / #1014 / #1013 / #840 /
 * #708 / #913 / #1010 / #670 without sharing those modules or rewriting
 * their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Orders detail action a11y supplier name
 * before it is interpolated into copy / send / receive labels.
 */
export function asciiTrimOrdersDetailActionSupplierName(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an Orders detail action a11y supplier name under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeOrdersDetailActionSupplierName(
  value: string
): string | null {
  const trimmed = asciiTrimOrdersDetailActionSupplierName(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Orders detail action a11y `visibleOrder.supplier_name`.
 * Preserves soft empty → null (intentional localized action.supplier.none
 * copy) while refusing to invent a clean supplier name via Unicode em-space /
 * NBSP trim. Does not throw; Unicode-padded / unsafe / non-string tokens
 * return null so the live `|| t("orders.detail.action.supplier.none")`
 * branch owns the fallback without inventing a clean Orders detail action
 * a11y supplier name from padding, and without letting non-nullish
 * Unicode-only space or empty string interpolate a blank-looking supplier
 * through the prior always-pass-name row.
 */
export function normalizeOrdersDetailActionSupplierName(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still interpolated into action a11y labels instead of the
  // intentional localized action.supplier.none copy.
  // Do not invent a clean Orders detail action a11y supplier name from padding.
  if (!value.trim()) return null;
  return canonicalizeOrdersDetailActionSupplierName(value);
}
