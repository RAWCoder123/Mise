/**
 * Orders hub review-queue recommendation supplier_name identity helpers
 * (MISE-005WQ).
 *
 * Pins Orders hub review-lane / pending-CTA recommendation supplier-name
 * presentation that previously always passed raw
 * `recommendation.supplier_name` (via grouped `supplierName`) into:
 * - the drafts-lane pending card title when exactly one supplier group exists
 *   (`groupedRecommendations[0]?.supplierName`); and
 * - the review-lane supplier header Text
 *   (`<Text style={styles.supplierName}>{supplierName}</Text>`).
 *
 * A Unicode-only-space supplier name (`"\u2003"`) is non-nullish and still
 * rendered as the entire supplierName line / pending title, so blank-looking
 * supplier identity appeared on the Orders review queue with no intentional
 * localized fallback. Empty string has the same blank-name bypass.
 * Separately, Unicode `.trim()` on a padded supplier name
 * (`"\u2003Sysco\u2003".trim() === "Sysco"`) would invent a clean display
 * supplier identity if that gate Unicode-trimmed before rendering into the
 * Orders review supplier chrome.
 *
 * Single-line supplier-name tips use ASCII end trim only and preserve NBSP
 * (no fold into plain space). Soft-null when Unicode trim would still strip
 * end padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded supplier name. Accents and case are preserved. Full C0/DEL
 * control rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **orders.review.supplierName.none** supplier-name
 * tokens only — the Orders hub review-queue `recommendation.supplier_name`
 * that falls through to that fallback when soft-null. Not SupplierDraftCard
 * order.supplier_name (#1050 / MISE-005WP), not Orders detail title
 * supplier_name (#1016 / MISE-005VH), not miseDomain draft-order
 * supplier_name (#1034 / MISE-005VZ), not orderPresentation line labels
 * (#887 / MISE-005RA), not supplier draft line labels (#972 / MISE-005UH),
 * not Home ApprovalsSection card.title (#1049 / MISE-005WO), not
 * orders.notice.copied order.supplier_name interpolations. Soft empty /
 * Unicode-padded / control-bearing tokens soft-null so the live
 * `|| t("orders.review.supplierName.none")` branch owns the intentional
 * localized fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1050 / #1049 / #1034 / #1016 / #972 / #887 without
 * sharing those modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Orders review supplier name before it
 * is rendered into the review supplierName Text / pending title.
 */
export function asciiTrimOrdersReviewSupplierName(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an Orders review supplier name under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeOrdersReviewSupplierName(
  value: string
): string | null {
  const trimmed = asciiTrimOrdersReviewSupplierName(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Orders hub review-queue `recommendation.supplier_name`
 * display. Preserves soft empty → null (intentional localized
 * supplierName.none copy) while refusing to invent a clean supplier name via
 * Unicode em-space / NBSP trim. Does not throw; Unicode-padded / unsafe /
 * non-string tokens return null so the live
 * `|| t("orders.review.supplierName.none")` branch owns the fallback
 * without inventing a clean Orders review supplier name from padding, and
 * without letting non-nullish Unicode-only space or empty string render a
 * blank-looking supplierName through the prior always-pass-name row.
 */
export function normalizeOrdersReviewSupplierName(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered as the supplierName Text / pending title
  // instead of the intentional localized supplierName.none copy.
  // Do not invent a clean Orders review supplier name from padding.
  if (!value.trim()) return null;
  return canonicalizeOrdersReviewSupplierName(value);
}
