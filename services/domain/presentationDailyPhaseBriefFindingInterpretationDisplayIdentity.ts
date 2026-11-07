/**
 * Daily Phase Brief FindingRow finding.interpretation display helpers
 * (MISE-005YY).
 *
 * Pins Daily Phase Brief FindingRow interpretation presentation that previously
 * always passed raw `finding.interpretation` into the findingBody Text:
 * `<Text style={styles.findingBody}>{finding.interpretation}</Text>`
 *
 * A Unicode-only-space finding interpretation (`"\u2003"`) is non-nullish and
 * still rendered as the entire findingBody line, so blank-looking interpretation
 * copy appeared on Daily Phase Brief finding rows with no intentional localized
 * fallback. Empty string has the same blank-body bypass. Separately, Unicode
 * `.trim()` on a padded interpretation
 * (`"\u2003Low stock before lunch\u2003".trim() === "Low stock before lunch"`)
 * would invent a clean display interpretation if that gate Unicode-trimmed
 * before rendering into the FindingRow findingBody Text.
 *
 * Interpretations are multiline operator / system free-text (parity with Daily
 * Brief Board finding.explanation display tip #1142 / MISE-005YJ, Home
 * Approvals recommendedAction presentation tip #1134 / MISE-005YB, and Daily
 * Brief recommended-action edit tip #884 / MISE-005QX): fold NBSP to a plain
 * space, then trim only C-locale `[[:space:]]` from the ends. Do not collapse
 * internal whitespace with `\s` or Unicode `String#trim`, so internal LF/TAB/CR
 * survive and em-space padding cannot invent equality with an unpadded
 * interpretation. Accents and case are preserved.
 *
 * Control gate matches the operator_note multiline allowlist: reject C0
 * controls and DEL except LF/TAB/CR. Full `[[:cntrl:]]` would reject the same
 * line breaks finding interpretations may carry into Phase Brief findingBody
 * Text. Distinct from finding-row a11y interpretation (#1085 / MISE-005XY),
 * which uses full C0/DEL rejection because that token is interpolated into a
 * single-line accessibility label.
 *
 * These are presentation **dailyPhaseBrief.findingInterpretation.none**
 * interpretation tokens only — the Daily Phase Brief FindingRow display
 * `finding.interpretation` that falls through to that fallback when soft-null.
 * Not finding-row a11y finding.interpretation (#1085 / MISE-005XY), not
 * finding.title display (#1156 / MISE-005YX), not finding.title a11y
 * (#1076 / MISE-005XP), not Daily Brief Board finding.explanation
 * (#1142 / MISE-005YJ), not Daily Brief Board finding.title (#1145 / MISE-005YM),
 * and not compact-preview firstFinding.title (#1146 / MISE-005YN). Soft empty /
 * Unicode-padded / control-bearing tokens soft-null so the live
 * `|| t("dailyPhaseBrief.findingInterpretation.none")` branch owns the
 * intentional localized fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1085 / #1156 / #1076 / #1142 / #1145 / #1146 without sharing
 * those modules or rewriting their call sites.
 */

const C_LEADING_WHITESPACE = /^[ \t\n\v\f\r]+/;
const C_TRAILING_WHITESPACE = /[ \t\n\v\f\r]+$/;
/** Allow LF/TAB/CR; reject other C0 controls and DEL (operator_note parity). */
const UNSAFE_MULTILINE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/**
 * Canonical free-text for Daily Phase Brief FindingRow display interpretations.
 * Folds NBSP, C-whitespace-trims ends only. Does not Unicode-trim or collapse
 * with `\s`, so em-space padding cannot invent equality with an unpadded
 * interpretation and internal newlines stay intact.
 */
export function canonicalDailyPhaseBriefFindingInterpretationDisplay(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_LEADING_WHITESPACE, "")
    .replace(C_TRAILING_WHITESPACE, "");
}

function hasUnsafeMultilineControls(value: string) {
  return UNSAFE_MULTILINE_CONTROL.test(value);
}

/**
 * Soft normalize for Daily Phase Brief FindingRow display
 * `finding.interpretation`. Preserves soft empty → null (intentional localized
 * findingInterpretation.none copy) while refusing to invent a clean
 * interpretation via Unicode em-space trim. Does not throw; Unicode-padded /
 * unsafe / non-string tokens return null so the live
 * `|| t("dailyPhaseBrief.findingInterpretation.none")` branch owns the
 * fallback without inventing a clean Phase Brief interpretation from padding,
 * and without letting non-nullish Unicode-only space or empty string render a
 * blank-looking findingBody through the prior always-pass-interpretation row.
 */
export function normalizeDailyPhaseBriefFindingInterpretationDisplay(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered as the findingBody Text instead of the
  // intentional localized findingInterpretation.none copy.
  // Do not invent a clean Daily Phase Brief FindingRow display interpretation
  // from padding.
  if (!value.trim()) return null;
  if (hasUnsafeMultilineControls(value)) return null;
  const prepared = canonicalDailyPhaseBriefFindingInterpretationDisplay(value);
  if (!prepared) return null;
  // Fail closed when Unicode trim would still strip end padding (em-space).
  // End NBSP already folded to plain space by canonical prep, so ordinary
  // ASCII end whitespace is already gone; remaining Unicode padding must not
  // invent equality with an unpadded interpretation on this display path.
  if (prepared !== prepared.trim()) return null;
  return prepared;
}
