/**
 * Daily Brief Board compact-preview firstFinding.explanation helpers (MISE-005YO).
 *
 * Pins Daily Brief Board compact-preview finding explanation presentation that
 * previously always passed raw `firstFinding.explanation` into the previewBody
 * Text:
 * `<Text numberOfLines={1} style={styles.previewBody}>{firstFinding.explanation}</Text>`
 *
 * A Unicode-only-space finding explanation (`"\u2003"`) is non-nullish and still
 * rendered as the entire previewBody line, so blank-looking explanation copy
 * appeared on the Daily Brief compact preview with no intentional localized
 * fallback. Empty string has the same blank-body bypass. Separately, Unicode
 * `.trim()` on a padded explanation
 * (`"\u2003Chicken Breast has less than one service day of projected coverage.\u2003".trim() ===
 * "Chicken Breast has less than one service day of projected coverage."`)
 * would invent a clean display explanation if that gate Unicode-trimmed before
 * rendering into the compact previewBody Text.
 *
 * Explanations are multiline operator / system free-text (parity with open
 * Board explanation display tip #1142 / MISE-005YJ and operational-findings
 * explanation domain tip #921 / MISE-005SI): fold NBSP to a plain space, then
 * trim only C-locale `[[:space:]]` from the ends. Do not collapse internal
 * whitespace with `\s` or Unicode `String#trim`, so internal LF/TAB/CR survive
 * and em-space padding cannot invent equality with an unpadded explanation.
 * Accents and case are preserved.
 *
 * Control gate matches the operator_note multiline allowlist: reject C0
 * controls and DEL except LF/TAB/CR. Full `[[:cntrl:]]` would reject the same
 * line breaks finding explanations may carry into Daily Brief compact preview
 * bodies (even though the Text is `numberOfLines={1}`).
 *
 * These are presentation **dailyBrief.compactPreview.findingExplanation.none**
 * explanation tokens only — the Daily Brief Board compact-preview
 * `firstFinding.explanation` that falls through to that fallback when
 * soft-null. Not Board explanation display (#1142 / MISE-005YJ), not compact
 * preview `firstFinding.title` (#1146 / MISE-005YN), not Board finding-card
 * title (#1145 / MISE-005YM), not card header / action / Phase Brief a11y
 * title tips (#1075 / #1074 / #1076), not domain title (#920), not Board
 * recommendedAction (#1143), not effectiveRecommendedAction annotation
 * (#1144), and not `app/more/daily-brief.tsx` finding chrome. Soft empty /
 * Unicode-padded / control-bearing tokens soft-null so the live
 * `|| t("dailyBrief.compactPreview.findingExplanation.none")` branch owns the
 * intentional localized fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1146 / #1145 / #1142 / #1075 / #1074 / #1076 / #920 /
 * #1143 / #1144 / #921 without sharing those modules or rewriting their call
 * sites.
 */

const C_LEADING_WHITESPACE = /^[ \t\n\v\f\r]+/;
const C_TRAILING_WHITESPACE = /[ \t\n\v\f\r]+$/;
/** Allow LF/TAB/CR; reject other C0 controls and DEL (operator_note parity). */
const UNSAFE_MULTILINE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/**
 * Canonical free-text for Daily Brief Board compact-preview finding
 * explanations. Folds NBSP, C-whitespace-trims ends only. Does not
 * Unicode-trim or collapse with `\s`, so em-space padding cannot invent
 * equality with an unpadded explanation and internal newlines stay intact.
 */
export function canonicalDailyBriefBoardCompactPreviewFindingExplanation(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_LEADING_WHITESPACE, "")
    .replace(C_TRAILING_WHITESPACE, "");
}

function hasUnsafeMultilineControls(value: string) {
  return UNSAFE_MULTILINE_CONTROL.test(value);
}

/**
 * Soft normalize for Daily Brief Board compact-preview
 * `firstFinding.explanation` display. Preserves soft empty → null
 * (intentional localized compactPreview.findingExplanation.none copy) while
 * refusing to invent a clean explanation via Unicode em-space trim. Does not
 * throw; Unicode-padded / unsafe / non-string tokens return null so the live
 * `|| t("dailyBrief.compactPreview.findingExplanation.none")` branch owns the
 * fallback without inventing a clean compact-preview explanation from padding,
 * and without letting non-nullish Unicode-only space or empty string render a
 * blank-looking previewBody through the prior always-pass-explanation row.
 */
export function normalizeDailyBriefBoardCompactPreviewFindingExplanation(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered as the previewBody Text instead of the
  // intentional localized compactPreview.findingExplanation.none copy.
  // Do not invent a clean Daily Brief Board compact-preview finding
  // explanation from padding.
  if (!value.trim()) return null;
  if (hasUnsafeMultilineControls(value)) return null;
  const prepared = canonicalDailyBriefBoardCompactPreviewFindingExplanation(value);
  if (!prepared) return null;
  // Fail closed when Unicode trim would still strip end padding (em-space).
  // End NBSP already folded to plain space by canonical prep, so ordinary
  // ASCII end whitespace is already gone; remaining Unicode padding must not
  // invent equality with an unpadded explanation on this display path.
  if (prepared !== prepared.trim()) return null;
  return prepared;
}
