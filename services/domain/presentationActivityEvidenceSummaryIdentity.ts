/**
 * Activity expanded evidence.summary helpers (MISE-005YW).
 *
 * Pins Activity expanded evidence-line presentation that previously always
 * passed raw `evidence.summary` into the evidence Text:
 * `{evidence.type.replace(/_/g, " ")} — {evidence.summary}`
 *
 * A Unicode-only-space evidence summary (`"\u2003"`) is non-nullish and still
 * rendered as the evidence line body after the type prefix, so blank-looking
 * evidence copy appeared with no intentional localized fallback. Empty string
 * has the same blank-body bypass. Separately, Unicode `.trim()` on a padded
 * summary
 * (`"\u2003On-hand coverage below reorder point.\u2003".trim() ===
 * "On-hand coverage below reorder point."`) would invent a clean display
 * summary if that gate Unicode-trimmed before rendering into the expanded
 * evidence Text.
 *
 * Evidence summaries are multiline operator / system free-text (parity with
 * Activity row event.summary tip #1150 / MISE-005YR and Restaurant Memory
 * evidence entry.summary tip #1154 / MISE-005YV): fold NBSP to a plain space,
 * then trim only C-locale `[[:space:]]` from the ends. Do not collapse
 * internal whitespace with `\s` or Unicode `String#trim`, so internal LF/TAB/CR
 * survive and em-space padding cannot invent equality with an unpadded
 * summary. Accents and case are preserved.
 *
 * Control gate matches the operator_note multiline allowlist: reject C0
 * controls and DEL except LF/TAB/CR. Full `[[:cntrl:]]` would reject the same
 * line breaks evidence summaries may carry into expanded Activity rows.
 *
 * These are presentation **activity.evidence.summary.none** summary tokens
 * only — the Activity expanded `evidence.summary` that falls through to that
 * fallback when soft-null. Not Activity hub row event.summary (#1150 /
 * MISE-005YR), not Home ActivityRow event.summary (#1151 / MISE-005YS), not
 * Activity hub row event.title (#1148 / MISE-005YP), not Home ActivityRow
 * event.title (#1149 / MISE-005YQ), not Activity expand a11y event.title
 * (#1071 / MISE-005XK), and not Restaurant Memory evidence entry.summary
 * (#1154 / MISE-005YV). Soft empty / Unicode-padded / control-bearing tokens
 * soft-null so the live `|| t("activity.evidence.summary.none")` branch owns
 * the intentional localized fallback. Ordinary ASCII whitespace still trims
 * clean.
 *
 * Complements open #1150 / #1151 / #1148 / #1149 / #1071 / #1154 without
 * sharing those modules or rewriting their call sites.
 */

const C_LEADING_WHITESPACE = /^[ \t\n\v\f\r]+/;
const C_TRAILING_WHITESPACE = /[ \t\n\v\f\r]+$/;
/** Allow LF/TAB/CR; reject other C0 controls and DEL (operator_note parity). */
const UNSAFE_MULTILINE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/**
 * Canonical free-text for Activity expanded evidence summaries. Folds NBSP,
 * C-whitespace-trims ends only. Does not Unicode-trim or collapse with `\s`, so
 * em-space padding cannot invent equality with an unpadded summary and
 * internal newlines stay intact.
 */
export function canonicalActivityEvidenceSummary(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_LEADING_WHITESPACE, "")
    .replace(C_TRAILING_WHITESPACE, "");
}

function hasUnsafeMultilineControls(value: string) {
  return UNSAFE_MULTILINE_CONTROL.test(value);
}

/**
 * Soft normalize for Activity expanded `evidence.summary` display. Preserves
 * soft empty → null (intentional localized activity.evidence.summary.none
 * copy) while refusing to invent a clean summary via Unicode em-space trim.
 * Does not throw; Unicode-padded / unsafe / non-string tokens return null so
 * the live `|| t("activity.evidence.summary.none")` branch owns the fallback
 * without inventing a clean Activity evidence summary from padding, and
 * without letting non-nullish Unicode-only space or empty string render a
 * blank-looking evidence line through the prior always-pass-summary path.
 */
export function normalizeActivityEvidenceSummary(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered as the evidence Text instead of the intentional
  // localized activity.evidence.summary.none copy.
  // Do not invent a clean Activity evidence summary from padding.
  if (!value.trim()) return null;
  if (hasUnsafeMultilineControls(value)) return null;
  const prepared = canonicalActivityEvidenceSummary(value);
  if (!prepared) return null;
  // Fail closed when Unicode trim would still strip end padding (em-space).
  // End NBSP already folded to plain space by canonical prep, so ordinary
  // ASCII end whitespace is already gone; remaining Unicode padding must not
  // invent equality with an unpadded summary on this display path.
  if (prepared !== prepared.trim()) return null;
  return prepared;
}
