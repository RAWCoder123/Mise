/**
 * Restaurant Memory evidence entry.summary helpers (MISE-005YV).
 *
 * Pins Restaurant Memory evidence-line presentation that previously always
 * passed raw `entry.summary` into the evidence Text:
 * `<Text style={styles.evidenceLine}>{entry.summary}{" · "}{formatDate(...)}</Text>`
 *
 * A Unicode-only-space evidence summary (`"\u2003"`) is non-nullish and still
 * rendered as the evidence line body, so blank-looking evidence copy appeared
 * with no intentional localized fallback. Empty string has the same blank-body
 * bypass. Separately, Unicode `.trim()` on a padded summary
 * (`"\u2003Matched 3 similar delivery delays\u2003".trim() ===
 * "Matched 3 similar delivery delays"`) would invent a clean display summary
 * if that gate Unicode-trimmed before rendering into the evidence line Text.
 *
 * Evidence summaries are multiline operator / system free-text (parity with
 * Activity row event.summary tip #1150 / MISE-005YR and Daily Brief Board
 * finding.explanation tip #1142 / MISE-005YJ): fold NBSP to a plain space,
 * then trim only C-locale `[[:space:]]` from the ends. Do not collapse
 * internal whitespace with `\s` or Unicode `String#trim`, so internal LF/TAB/CR
 * survive and em-space padding cannot invent equality with an unpadded
 * summary. Accents and case are preserved.
 *
 * Control gate matches the operator_note multiline allowlist: reject C0
 * controls and DEL except LF/TAB/CR. Full `[[:cntrl:]]` would reject the same
 * line breaks evidence summaries may carry into Restaurant Memory cards.
 *
 * These are presentation **memory.evidence.summary.none** summary tokens only —
 * the Restaurant Memory evidence `entry.summary` that falls through to that
 * fallback when soft-null. Not restaurant-memory statement free-text (#830 /
 * MISE-005OV), not restaurant-memory correction draft (#848 / MISE-005PN),
 * not restaurant-memory scope/source (#841 / MISE-005PG), not Memory subtitle
 * restaurant.name (#1042 / MISE-005WH), not Activity expanded evidence.summary
 * display, and not Activity hub row event.summary (#1150 / MISE-005YR). Soft
 * empty / Unicode-padded / control-bearing tokens soft-null so the live
 * `|| t("memory.evidence.summary.none")` branch owns the intentional localized
 * fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #830 / #848 / #841 / #1042 / #1150 without sharing those
 * modules or rewriting their call sites.
 */

const C_LEADING_WHITESPACE = /^[ \t\n\v\f\r]+/;
const C_TRAILING_WHITESPACE = /[ \t\n\v\f\r]+$/;
/** Allow LF/TAB/CR; reject other C0 controls and DEL (operator_note parity). */
const UNSAFE_MULTILINE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/**
 * Canonical free-text for Restaurant Memory evidence summaries. Folds NBSP,
 * C-whitespace-trims ends only. Does not Unicode-trim or collapse with `\s`, so
 * em-space padding cannot invent equality with an unpadded summary and
 * internal newlines stay intact.
 */
export function canonicalRestaurantMemoryEvidenceSummary(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_LEADING_WHITESPACE, "")
    .replace(C_TRAILING_WHITESPACE, "");
}

function hasUnsafeMultilineControls(value: string) {
  return UNSAFE_MULTILINE_CONTROL.test(value);
}

/**
 * Soft normalize for Restaurant Memory evidence `entry.summary` display.
 * Preserves soft empty → null (intentional localized
 * memory.evidence.summary.none copy) while refusing to invent a clean summary
 * via Unicode em-space trim. Does not throw; Unicode-padded / unsafe /
 * non-string tokens return null so the live
 * `|| t("memory.evidence.summary.none")` branch owns the fallback without
 * inventing a clean Restaurant Memory evidence summary from padding, and
 * without letting non-nullish Unicode-only space or empty string render a
 * blank-looking evidence line through the prior always-pass-summary card.
 */
export function normalizeRestaurantMemoryEvidenceSummary(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered as the evidence Text instead of the intentional
  // localized memory.evidence.summary.none copy.
  // Do not invent a clean Restaurant Memory evidence summary from padding.
  if (!value.trim()) return null;
  if (hasUnsafeMultilineControls(value)) return null;
  const prepared = canonicalRestaurantMemoryEvidenceSummary(value);
  if (!prepared) return null;
  // Fail closed when Unicode trim would still strip end padding (em-space).
  // End NBSP already folded to plain space by canonical prep, so ordinary
  // ASCII end whitespace is already gone; remaining Unicode padding must not
  // invent equality with an unpadded summary on this display path.
  if (prepared !== prepared.trim()) return null;
  return prepared;
}
