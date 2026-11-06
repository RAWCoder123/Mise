/**
 * Home StatusNotice restaurantStatus.topRisk helpers (MISE-005YF).
 *
 * Pins Home restaurant-status `StatusNotice` message selection when it gates
 * on `brief.restaurantStatus.topRisk` outside the Expo UI graph so Node tests
 * can exercise inventing and fallback-bypass proofs without loading React
 * Native.
 *
 * Prior path Unicode-trimmed the top-risk gate:
 * `const topRisk = brief.restaurantStatus.topRisk?.trim();`
 * then selected `topRisk ? t(statusKey) : primaryApproval?.whyItMatters ??
 * brief.restaurantStatus.summary`. Unicode `.trim()` on a padded top-risk
 * string
 * (`"\u2003Chicken breast is projected to stock out before dinner.\u2003".trim() ===
 * "Chicken breast is projected to stock out before dinner."`)
 * invents a clean gate presence and forces the localized status-sentence
 * branch. Separately, a Unicode-only-space top-risk string (`"\u2003"`) is
 * non-nullish (`Boolean("\u2003") === true`); without a soft-null gate it would
 * also force `t(statusKey)` instead of falling through to why-it-matters /
 * restaurant-status summary. Empty string is already falsy after optional
 * chaining, but soft-null keeps the intentional fallthrough explicit.
 *
 * Top-risk strings are multiline operator / system free-text (parity with
 * Home StatusNotice restaurant-status summary tip #1137 / MISE-005YE, Home
 * StatusNotice whyItMatters tip #1136 / MISE-005YD, Home ApprovalsSection
 * whyItMatters tip #1135 / MISE-005YC, and recommendedAction tip #1134 /
 * MISE-005YB): fold NBSP to a plain space, then trim only C-locale
 * `[[:space:]]` from the ends. Do not collapse internal whitespace with `\s`
 * or Unicode `String#trim`, so internal LF/TAB/CR survive and em-space
 * padding cannot invent equality with an unpadded top-risk string. Accents
 * and case are preserved.
 *
 * Control gate matches the operator_note multiline allowlist: reject C0
 * controls and DEL except LF/TAB/CR. Full `[[:cntrl:]]` would reject the same
 * line breaks a top-risk detail may carry into the StatusNotice gate.
 *
 * These are Home StatusNotice **restaurant-status topRisk message-gate**
 * presentation tokens only — the `brief.restaurantStatus.topRisk` that selects
 * between `t(statusKey)` and the why-it-matters / summary fallthrough. Not
 * Home StatusNotice restaurant-status summary (#1137 / MISE-005YE), not Home
 * StatusNotice `primaryApproval?.whyItMatters` (#1136 / MISE-005YD), not
 * ApprovalsSection card.whyItMatters (#1135 / MISE-005YC), not card.title
 * (#1049 / MISE-005WO), not card.recommendedAction (#1134 / MISE-005YB), not
 * Home StatusNotice approval titles (#1011 / MISE-005VC), not Home greeting
 * restaurant.name (#1044 / MISE-005WJ). Soft empty / Unicode-padded /
 * control-bearing tokens soft-null so the live why-it-matters / summary
 * fallthrough owns the intentional StatusNotice message when the gate cannot
 * be proven without inventing. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1137 / #1136 / #1135 / #1134 / #1049 / #1011 / #1044
 * without sharing those modules or rewriting their call sites. Distinct
 * inventing/bypass proof from #1137: that tip soft-nulls summary into the
 * localized status sentence; this tip soft-nulls the topRisk gate so unsafe
 * padding cannot invent status-sentence selection.
 */

const C_LEADING_WHITESPACE = /^[ \t\n\v\f\r]+/;
const C_TRAILING_WHITESPACE = /[ \t\n\v\f\r]+$/;
/** Allow LF/TAB/CR; reject other C0 controls and DEL (operator_note parity). */
const UNSAFE_MULTILINE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/**
 * Canonical free-text for Home StatusNotice restaurant-status topRisk gate.
 * Folds NBSP, C-whitespace-trims ends only. Does not Unicode-trim or collapse
 * with `\s`, so em-space padding cannot invent equality with an unpadded
 * top-risk string and internal newlines stay intact.
 */
export function canonicalHomeStatusTopRisk(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_LEADING_WHITESPACE, "")
    .replace(C_TRAILING_WHITESPACE, "");
}

function hasUnsafeMultilineControls(value: string) {
  return UNSAFE_MULTILINE_CONTROL.test(value);
}

/**
 * Soft normalize for Home StatusNotice `brief.restaurantStatus.topRisk` gate.
 * Preserves soft empty → null (intentional why-it-matters / summary fallthrough)
 * while refusing to invent a clean top-risk presence via Unicode em-space
 * trim. Does not throw; Unicode-padded / unsafe / non-string tokens return
 * null so the live fallthrough branch owns the StatusNotice message without
 * inventing a clean gate from padding, and without letting non-nullish
 * Unicode-only space force `t(statusKey)` through the prior `.trim()` path.
 */
export function normalizeHomeStatusTopRisk(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still counted as a present topRisk after Boolean checks and
  // would force the localized status-sentence branch instead of the
  // intentional why-it-matters / summary fallthrough.
  // Do not invent a clean Home StatusNotice topRisk gate from padding.
  if (!value.trim()) return null;
  if (hasUnsafeMultilineControls(value)) return null;
  const prepared = canonicalHomeStatusTopRisk(value);
  if (!prepared) return null;
  // Fail closed when Unicode trim would still strip end padding (em-space).
  // End NBSP already folded to plain space by canonical prep, so ordinary
  // ASCII end whitespace is already gone; remaining Unicode padding must not
  // invent equality with an unpadded top-risk string on this gate path.
  if (prepared !== prepared.trim()) return null;
  return prepared;
}
