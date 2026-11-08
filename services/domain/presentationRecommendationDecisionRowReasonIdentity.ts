/**
 * RecommendationDecisionRow recommendation.reason helpers (MISE-005ZX).
 *
 * Pins Orders review RecommendationDecisionRow expanded reason presentation
 * that previously always passed raw free-form `recommendation.reason`:
 *   `{expanded ? <Text style={styles.reason}>{recommendation.reason}</Text> : null}`
 *
 * Purchase recommendation reasons are free-form prose. Domain generation
 * embeds free-form inventory `item.item_name` into the reason
 * (`recommendationReason` / `learnedRecommendationReason` /
 * `getWhyItMatters` rising-trend copy), and operating-plan why selection
 * Unicode-trims stored reason (`recommendation?.reason?.trim()`). A
 * Unicode-padded reason
 * (`"\u2003Roma Tomatoes is below reorder level.\u2003".trim() ===
 * "Roma Tomatoes is below reorder level."`) invents a clean reason identity
 * before the RecommendationDecisionRow reason Text renders it. Separately, a
 * Unicode-only-space reason (`"\u2003"`) is non-nullish and still rendered as
 * the entire reason Text when expanded, so blank-looking reason copy appeared
 * with no intentional localized none marker. Empty string has the same
 * blank-reason bypass when it reaches the always-pass Text.
 *
 * Reason copy is multiline free-text (parity with Create Task list body tip
 * #1181 / MISE-005ZW, Activity evidence.summary tip #1155 / MISE-005YW, and
 * purchase_recommendations.reason cntrl CHECK #662 / MISE-005IT which allows
 * LF/TAB/CR): fold NBSP to a plain space, then trim only C-locale
 * `[[:space:]]` from the ends. Do not collapse internal whitespace with `\s`
 * or Unicode `String#trim`, so internal LF/TAB/CR survive and em-space
 * padding cannot invent equality with an unpadded reason. Accents and case
 * are preserved.
 *
 * Control gate matches the operator_note multiline allowlist: reject C0
 * controls and DEL except LF/TAB/CR. Full `[[:cntrl:]]` would reject the same
 * line breaks purchase recommendation reasons may carry under the
 * MISE-005IT CHECK into the expanded reason panel.
 *
 * These are presentation **orders.recommendation.reason.none** reason tokens
 * only — the RecommendationDecisionRow expanded `recommendation.reason` that
 * falls through to that fallback when soft-null. Not RecommendationDecisionRow
 * item_name (#1055 / MISE-005WU), not Orders review supplier_name (#1051),
 * not Inventory detail item_name / supplier_name (#1017 / #1052), not
 * SupplierDraftCard surfaces (#1050 / #972), not Home ApprovalsSection
 * whyItMatters / recommendedAction (#1135 / #1134), not Daily Report
 * signal.line (#1179), and not operating-plan why tokens (#865). Soft empty /
 * Unicode-padded / control-bearing tokens soft-null so the live
 * `|| t("orders.recommendation.reason.none")` branch owns the intentional
 * localized fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1055 / #1051 / #1017 / #1052 / #1050 / #972 / #1135 /
 * #1134 / #1179 / #865 / #662 without sharing those modules or rewriting
 * their call sites.
 */

const C_LEADING_WHITESPACE = /^[ \t\n\v\f\r]+/;
const C_TRAILING_WHITESPACE = /[ \t\n\v\f\r]+$/;
/** Allow LF/TAB/CR; reject other C0 controls and DEL (operator_note parity). */
const UNSAFE_MULTILINE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/**
 * Canonical free-text for RecommendationDecisionRow expanded reasons. Folds
 * NBSP, C-whitespace-trims ends only. Does not Unicode-trim or collapse with
 * `\s`, so em-space padding cannot invent equality with an unpadded reason
 * and internal newlines stay intact.
 */
export function canonicalRecommendationDecisionRowReason(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_LEADING_WHITESPACE, "")
    .replace(C_TRAILING_WHITESPACE, "");
}

function hasUnsafeMultilineControls(value: string) {
  return UNSAFE_MULTILINE_CONTROL.test(value);
}

/**
 * Soft normalize for RecommendationDecisionRow expanded `recommendation.reason`.
 * Preserves soft empty → null (intentional localized
 * orders.recommendation.reason.none copy) while refusing to invent a clean
 * reason via Unicode em-space trim. Does not throw; Unicode-padded / unsafe /
 * non-string tokens return null so the live
 * `|| t("orders.recommendation.reason.none")` branch owns the fallback without
 * inventing a clean RecommendationDecisionRow reason from padding, and without
 * letting non-nullish Unicode-only space or empty string render a
 * blank-looking reason through the prior always-pass-reason Text.
 */
export function normalizeRecommendationDecisionRowReason(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered as the expanded reason Text instead of the
  // intentional localized orders.recommendation.reason.none copy.
  // Do not invent a clean RecommendationDecisionRow reason from padding.
  if (!value.trim()) return null;
  if (hasUnsafeMultilineControls(value)) return null;
  const prepared = canonicalRecommendationDecisionRowReason(value);
  if (!prepared) return null;
  // Fail closed when Unicode trim would still strip end padding (em-space).
  // End NBSP already folded to plain space by canonical prep, so ordinary
  // ASCII end whitespace is already gone; remaining Unicode padding must not
  // invent equality with an unpadded reason on this display path.
  if (prepared !== prepared.trim()) return null;
  return prepared;
}
