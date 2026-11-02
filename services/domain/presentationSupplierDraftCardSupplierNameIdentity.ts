/**
 * SupplierDraftCard supplier_name identity helpers (MISE-005WP).
 *
 * Pins Orders hub SupplierDraftCard supplier-name presentation that previously
 * always passed raw `order.supplier_name` into the supplierName Text and
 * accessibility interpolations:
 * `<Text style={styles.supplierName}>{order.supplier_name}</Text>`
 *
 * A Unicode-only-space supplier name (`"\u2003"`) is non-nullish and still
 * rendered as the entire supplierName line, so blank-looking supplier identity
 * appeared on draft/sent/received order cards with no intentional localized
 * fallback. Empty string has the same blank-name bypass. Separately,
 * Unicode `.trim()` on a padded supplier name
 * (`"\u2003Sysco\u2003".trim() === "Sysco"`) would invent a clean display
 * supplier identity if that gate Unicode-trimmed before rendering into the
 * SupplierDraftCard supplierName chrome.
 *
 * Single-line supplier-name tips use ASCII end trim only and preserve NBSP
 * (no fold into plain space). Soft-null when Unicode trim would still strip
 * end padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded supplier name. Accents and case are preserved. Full C0/DEL
 * control rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **orders.card.supplier.none** supplier-name tokens
 * only — the SupplierDraftCard `order.supplier_name` that falls through to
 * that fallback when soft-null. Not Orders detail title supplier_name
 * (#1016 / MISE-005VH), not miseDomain draft-order supplier_name (#1034 /
 * MISE-005VZ), not orderPresentation line labels (#887 / MISE-005RA), not
 * supplier draft line labels (#972 / MISE-005UH), not Home ApprovalsSection
 * card.title (#1049 / MISE-005WO). Soft empty / Unicode-padded /
 * control-bearing tokens soft-null so the live
 * `|| t("orders.card.supplier.none")` branch owns the intentional localized
 * fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1049 / #1034 / #1016 / #972 / #887 without sharing those
 * modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized SupplierDraftCard supplier name before it
 * is rendered into the supplierName Text.
 */
export function asciiTrimSupplierDraftCardSupplierName(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a SupplierDraftCard supplier name under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeSupplierDraftCardSupplierName(
  value: string
): string | null {
  const trimmed = asciiTrimSupplierDraftCardSupplierName(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for SupplierDraftCard `order.supplier_name` display.
 * Preserves soft empty → null (intentional localized supplier.none copy) while
 * refusing to invent a clean supplier name via Unicode em-space / NBSP trim.
 * Does not throw; Unicode-padded / unsafe / non-string tokens return null so
 * the live `|| t("orders.card.supplier.none")` branch owns the fallback
 * without inventing a clean SupplierDraftCard supplier name from padding, and
 * without letting non-nullish Unicode-only space or empty string render a
 * blank-looking supplierName through the prior always-pass-name row.
 */
export function normalizeSupplierDraftCardSupplierName(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered as the supplierName Text instead of the
  // intentional localized supplier.none copy.
  // Do not invent a clean SupplierDraftCard supplier name from padding.
  if (!value.trim()) return null;
  return canonicalizeSupplierDraftCardSupplierName(value);
}
