/**
 * Home StatusNotice primaryApproval.whyItMatters helpers (MISE-005YD).
 *
 * Pins Home restaurant-status `StatusNotice` message selection when it falls
 * through from `primaryApproval?.whyItMatters` to
 * `brief.restaurantStatus.summary` outside the Expo UI graph so Node tests can
 * exercise inventing and fallback-bypass proofs without loading React Native.
 *
 * Prior path used nullish coalescing only:
 * `primaryApproval?.whyItMatters ?? brief.restaurantStatus.summary`.
 * An empty string (`""`) is not nullish, so it still rendered as a blank
 * StatusNotice message and blocked the restaurant-status summary fallback. A
 * Unicode-only-space why-it-matters string (`"\u2003"`) is likewise non-nullish
 * (`Boolean("\u2003") === true`) and rendered blank-looking body copy with no
 * intentional summary fallback. Separately, Unicode `.trim()` on a padded
 * why-it-matters string
 * (`"\u2003Lunch usage was 24% above forecast.\u2003".trim() === "Lunch usage was 24% above forecast."`)
 * would invent a clean display reason if that gate Unicode-trimmed before
 * rendering into the StatusNotice message.
 *
 * Why-it-matters strings are multiline operator / system free-text (parity with
 * Home ApprovalsSection whyItMatters tip #1135 / MISE-005YC, recommendedAction
 * tip #1134 / MISE-005YB, open finding recommended-action domain tip #832 /
 * MISE-005OX, and Daily Brief recommended-action edit tip #884 / MISE-005QX):
 * fold NBSP to a plain space, then trim only C-locale `[[:space:]]` from the
 * ends. Do not collapse internal whitespace with `\s` or Unicode
 * `String#trim`, so internal LF/TAB/CR survive and em-space padding cannot
 * invent equality with an unpadded why-it-matters string. Accents and case
 * are preserved.
 *
 * Control gate matches the operator_note multiline allowlist: reject C0
 * controls and DEL except LF/TAB/CR. Full `[[:cntrl:]]` would reject the same
 * line breaks approval why copy may carry into the StatusNotice message.
 *
 * These are Home StatusNotice **approval why-it-matters message** presentation
 * tokens only — the `primaryApproval?.whyItMatters` that falls through to
 * `brief.restaurantStatus.summary` when soft-null. Not Home StatusNotice
 * approval titles (#1011 / MISE-005VC), not ApprovalsSection card.whyItMatters
 * (#1135 / MISE-005YC), not card.title (#1049 / MISE-005WO), not
 * card.recommendedAction (#1134 / MISE-005YB), not Home greeting
 * restaurant.name (#1044 / MISE-005WJ), not finding recommended-action domain
 * require paths (#832), not Daily Brief edit normalize (#884). Soft empty /
 * Unicode-padded / control-bearing tokens soft-null so the live
 * `|| brief.restaurantStatus.summary` branch owns the intentional restaurant-
 * status summary fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1011 / #1135 / #1049 / #1134 / #1044 / #832 / #884 without
 * sharing those modules or rewriting their call sites.
 */

const C_LEADING_WHITESPACE = /^[ \t\n\v\f\r]+/;
const C_TRAILING_WHITESPACE = /[ \t\n\v\f\r]+$/;
/** Allow LF/TAB/CR; reject other C0 controls and DEL (operator_note parity). */
const UNSAFE_MULTILINE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/**
 * Canonical free-text for Home StatusNotice approval why-it-matters copy.
 * Folds NBSP, C-whitespace-trims ends only. Does not Unicode-trim or collapse
 * with `\s`, so em-space padding cannot invent equality with an unpadded
 * why-it-matters string and internal newlines stay intact.
 */
export function canonicalHomeStatusWhyItMatters(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_LEADING_WHITESPACE, "")
    .replace(C_TRAILING_WHITESPACE, "");
}

function hasUnsafeMultilineControls(value: string) {
  return UNSAFE_MULTILINE_CONTROL.test(value);
}

/**
 * Soft normalize for Home StatusNotice `primaryApproval.whyItMatters` display.
 * Preserves soft empty → null (intentional restaurant-status summary fallback)
 * while refusing to invent a clean why-it-matters string via Unicode em-space
 * trim. Does not throw; Unicode-padded / unsafe / non-string tokens return
 * null so the live `|| brief.restaurantStatus.summary` branch owns the
 * fallback without inventing a clean StatusNotice message from padding, and
 * without letting non-nullish Unicode-only space or empty string render a
 * blank-looking StatusNotice message through the prior
 * `?? brief.restaurantStatus.summary` path.
 */
export function normalizeHomeStatusWhyItMatters(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered as the StatusNotice message instead of the
  // intentional restaurant-status summary fallback.
  // Do not invent a clean Home StatusNotice why-it-matters string from padding.
  if (!value.trim()) return null;
  if (hasUnsafeMultilineControls(value)) return null;
  const prepared = canonicalHomeStatusWhyItMatters(value);
  if (!prepared) return null;
  // Fail closed when Unicode trim would still strip end padding (em-space).
  // End NBSP already folded to plain space by canonical prep, so ordinary
  // ASCII end whitespace is already gone; remaining Unicode padding must not
  // invent equality with an unpadded why-it-matters string on this display path.
  if (prepared !== prepared.trim()) return null;
  return prepared;
}
