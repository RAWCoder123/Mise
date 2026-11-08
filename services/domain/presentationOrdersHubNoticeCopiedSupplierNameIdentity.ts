/**
 * Orders hub notice.copied supplier_name identity helpers (MISE-005AAC).
 *
 * Pins the Orders hub StatusNotice path that previously always passed raw
 * `order.supplier_name` into the copied-order notice interpolation:
 *   `t("orders.notice.copied", { supplier: order.supplier_name })`
 *
 * A Unicode-only-space supplier name (`"\u2003"`) is non-nullish and truthy as
 * a supplier_order field, so the Orders hub still interpolated a blank-looking
 * supplier identity (`" order copied."` / `"Pedido de  copiado."`) with no
 * intentional localized fallback. Empty string has the same blank-looking
 * supplier path. Separately, Unicode `.trim()` on a padded supplier name
 * (`"\u2003Sysco\u2003".trim() === "Sysco"`) would invent a clean display
 * supplier identity if that gate Unicode-trimmed before interpolating into the
 * Orders hub copied notice.
 *
 * Single-line supplier-name tips use ASCII end trim only and preserve NBSP
 * (no fold into plain space). Soft-null when Unicode trim would still strip
 * end padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded supplier name. Accents and case are preserved. Full C0/DEL
 * control rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **orders.notice.supplierName.none** supplier-name
 * tokens only — the Orders hub `orders.notice.copied` `{supplier}` that falls
 * through to that fallback when soft-null. Not Orders hub notice item_name
 * (#1057 / MISE-005WW), not SupplierDraftCard order.supplier_name
 * (#1050 / MISE-005WP), not Orders review recommendation.supplier_name
 * (#1051 / MISE-005WQ), not Orders detail title supplier_name
 * (#1016 / MISE-005VH), not Orders detail action a11y supplier_name
 * (#1068 / MISE-005XH), and not `order_copied` telemetry `supplier_name`
 * (analytics retains the raw field). Soft empty / Unicode-padded /
 * control-bearing tokens soft-null so the live
 * `|| t("orders.notice.supplierName.none")` branch owns the intentional
 * localized fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1057 / #1051 / #1050 / #1068 / #1016 without sharing those
 * modules or rewriting their call sites. #1057 explicitly left this copied
 * supplier notice path alone.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Orders hub copied-notice supplier name
 * before it is interpolated into StatusNotice copy.
 */
export function asciiTrimOrdersHubNoticeCopiedSupplierName(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an Orders hub notice.copied supplier name under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeOrdersHubNoticeCopiedSupplierName(
  value: string
): string | null {
  const trimmed = asciiTrimOrdersHubNoticeCopiedSupplierName(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Orders hub `orders.notice.copied` `{supplier}` display.
 * Preserves soft empty → null (intentional localized
 * orders.notice.supplierName.none copy) while refusing to invent a clean
 * supplier name via Unicode em-space / NBSP trim. Does not throw;
 * Unicode-padded / unsafe / non-string tokens return null so the live
 * `|| t("orders.notice.supplierName.none")` branch owns the fallback
 * without inventing a clean Orders hub copied-notice supplier name from
 * padding, and without letting non-nullish Unicode-only space or empty string
 * interpolate a blank-looking supplier through the prior always-pass-name
 * chrome.
 */
export function normalizeOrdersHubNoticeCopiedSupplierName(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still interpolated into Orders hub copied notices as a
  // blank-looking supplier identity.
  // Do not invent a clean Orders hub copied-notice supplier name from padding.
  if (!value.trim()) return null;
  return canonicalizeOrdersHubNoticeCopiedSupplierName(value);
}
