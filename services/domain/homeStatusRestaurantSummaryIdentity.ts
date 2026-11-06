/**
 * Home StatusNotice restaurantStatus.summary helpers (MISE-005YE).
 *
 * Pins Home restaurant-status `StatusNotice` message selection when it falls
 * through from `primaryApproval?.whyItMatters` to
 * `brief.restaurantStatus.summary` outside the Expo UI graph so Node tests can
 * exercise inventing and fallback-bypass proofs without loading React Native.
 *
 * Prior path ended the StatusNotice message chain at the raw summary:
 * `primaryApproval?.whyItMatters ?? brief.restaurantStatus.summary`.
 * An empty string summary (`""`) is not nullish, so it still rendered as a
 * blank StatusNotice message with no intentional localized status-sentence
 * fallback. A Unicode-only-space summary (`"\u2003"`) is likewise non-nullish
 * (`Boolean("\u2003") === true`) and rendered blank-looking body copy. Separately,
 * Unicode `.trim()` on a padded summary string
 * (`"\u2003Attention needed: 1 approval and 2 inventory watch items are open.\u2003".trim() ===
 * "Attention needed: 1 approval and 2 inventory watch items are open."`)
 * would invent a clean display summary if that gate Unicode-trimmed before
 * rendering into the StatusNotice message.
 *
 * Restaurant-status summary strings are multiline operator / system free-text
 * (parity with Home StatusNotice whyItMatters tip #1136 / MISE-005YD, Home
 * ApprovalsSection whyItMatters tip #1135 / MISE-005YC, recommendedAction tip
 * #1134 / MISE-005YB, open finding recommended-action domain tip #832 /
 * MISE-005OX, and Daily Brief recommended-action edit tip #884 / MISE-005QX):
 * fold NBSP to a plain space, then trim only C-locale `[[:space:]]` from the
 * ends. Do not collapse internal whitespace with `\s` or Unicode
 * `String#trim`, so internal LF/TAB/CR survive and em-space padding cannot
 * invent equality with an unpadded summary string. Accents and case are
 * preserved.
 *
 * Control gate matches the operator_note multiline allowlist: reject C0
 * controls and DEL except LF/TAB/CR. Full `[[:cntrl:]]` would reject the same
 * line breaks a restaurant-status summary may carry into the StatusNotice
 * message.
 *
 * These are Home StatusNotice **restaurant-status summary message**
 * presentation tokens only — the `brief.restaurantStatus.summary` that falls
 * through to `t(statusKey)` (`home.status.attention_needed` /
 * `home.status.at_risk`) when soft-null. Not Home StatusNotice
 * `primaryApproval?.whyItMatters` (#1136 / MISE-005YD), not ApprovalsSection
 * card.whyItMatters (#1135 / MISE-005YC), not card.title (#1049 / MISE-005WO),
 * not card.recommendedAction (#1134 / MISE-005YB), not Home StatusNotice
 * approval titles (#1011 / MISE-005VC), not Home greeting restaurant.name
 * (#1044 / MISE-005WJ), not finding recommended-action domain require paths
 * (#832), not Daily Brief edit normalize (#884), not the `topRisk?.trim()`
 * StatusNotice message gate. Soft empty / Unicode-padded / control-bearing
 * tokens soft-null so the live `?? t(statusKey)` branch owns the intentional
 * localized status-sentence fallback. Ordinary ASCII whitespace still trims
 * clean.
 *
 * Complements open #1136 / #1135 / #1134 / #1049 / #1011 / #1044 / #832 / #884
 * without sharing those modules or rewriting their call sites. Distinct
 * inventing/bypass proof from #1136: that tip soft-nulls why-it-matters into
 * summary; this tip soft-nulls summary into the localized status sentence.
 */

const C_LEADING_WHITESPACE = /^[ \t\n\v\f\r]+/;
const C_TRAILING_WHITESPACE = /[ \t\n\v\f\r]+$/;
/** Allow LF/TAB/CR; reject other C0 controls and DEL (operator_note parity). */
const UNSAFE_MULTILINE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/**
 * Canonical free-text for Home StatusNotice restaurant-status summary copy.
 * Folds NBSP, C-whitespace-trims ends only. Does not Unicode-trim or collapse
 * with `\s`, so em-space padding cannot invent equality with an unpadded
 * summary string and internal newlines stay intact.
 */
export function canonicalHomeStatusRestaurantSummary(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_LEADING_WHITESPACE, "")
    .replace(C_TRAILING_WHITESPACE, "");
}

function hasUnsafeMultilineControls(value: string) {
  return UNSAFE_MULTILINE_CONTROL.test(value);
}

/**
 * Soft normalize for Home StatusNotice `brief.restaurantStatus.summary` display.
 * Preserves soft empty → null (intentional localized status-sentence fallback)
 * while refusing to invent a clean summary string via Unicode em-space trim.
 * Does not throw; Unicode-padded / unsafe / non-string tokens return null so
 * the live `?? t(statusKey)` branch owns the fallback without inventing a
 * clean StatusNotice message from padding, and without letting non-nullish
 * Unicode-only space or empty string render a blank-looking StatusNotice
 * message through the prior raw-summary path.
 */
export function normalizeHomeStatusRestaurantSummary(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered as the StatusNotice message instead of the
  // intentional localized status-sentence fallback.
  // Do not invent a clean Home StatusNotice summary string from padding.
  if (!value.trim()) return null;
  if (hasUnsafeMultilineControls(value)) return null;
  const prepared = canonicalHomeStatusRestaurantSummary(value);
  if (!prepared) return null;
  // Fail closed when Unicode trim would still strip end padding (em-space).
  // End NBSP already folded to plain space by canonical prep, so ordinary
  // ASCII end whitespace is already gone; remaining Unicode padding must not
  // invent equality with an unpadded summary string on this display path.
  if (prepared !== prepared.trim()) return null;
  return prepared;
}
