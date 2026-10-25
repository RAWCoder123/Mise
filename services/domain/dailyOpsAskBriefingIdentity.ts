/**
 * Daily Ops Ask Mise briefing free-text helpers (MISE-005QF).
 *
 * Pins `buildDailyOpsReport` managerAdvice `askBriefingText` prep outside the
 * repository graph so Node tests can exercise inventing proofs without loading
 * Supabase or AsyncStorage. The prior path Unicode-trimmed Ask Mise briefing
 * prose before storing the trimmed result on the Daily Ops report
 * (`'\u2003Confirm walk-in before close\u2003'.trim() === 'Confirm walk-in before close'`).
 *
 * Ask Mise briefing text is multiline operator / system free-text (parity with
 * open MISE-005QE operating-plan why / MISE-005PT inventory-operation note /
 * MISE-005PF supplier operator_note / MISE-005OU Mise-actions lesson): fold
 * NBSP to a plain space, then trim only C-locale `[[:space:]]` from the ends.
 * Do not collapse internal whitespace with `\s` or Unicode `String#trim`, so
 * internal LF/TAB/CR survive and em-space padding cannot invent equality with
 * an unpadded briefing. Accents and case are preserved.
 *
 * Control gate matches the operator_note multiline allowlist: reject C0
 * controls and DEL except LF/TAB/CR. Full `[[:cntrl:]]` would reject the same
 * line breaks operators need in a briefing answer.
 *
 * Soft empty after prep stays `null` so the Daily Ops report can omit the Ask
 * Mise briefing section (prior `.trim()` emptiness fallthrough). Unsafe-control
 * tokens also soft to `null` on this read-side projection so a bad Ask Mise
 * answer cannot crash Daily Ops report construction (fail-closed persist tips
 * own throw contracts elsewhere). No new max-length bound is introduced; the
 * prior helper did not truncate.
 *
 * Complements open daily-report restaurant-workspace tip (#750) without sharing
 * that module or rewriting `pickSignalLine` insight `recommended_action` /
 * `why_it_matters` Unicode trim on main. Those remain on their existing
 * contracts in this tip.
 */

const C_LEADING_WHITESPACE = /^[ \t\n\v\f\r]+/;
const C_TRAILING_WHITESPACE = /[ \t\n\v\f\r]+$/;
/** Allow LF/TAB/CR; reject other C0 controls and DEL (operator_note parity). */
const UNSAFE_MULTILINE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/**
 * Canonical free-text for Daily Ops Ask Mise briefing tokens. Folds NBSP,
 * C-whitespace-trims ends only. Does not Unicode-trim or collapse with `\s`, so
 * em-space padding cannot invent equality with an unpadded briefing and
 * internal newlines stay intact.
 */
export function canonicalDailyOpsAskBriefingText(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_LEADING_WHITESPACE, "")
    .replace(C_TRAILING_WHITESPACE, "");
}

function hasUnsafeMultilineControls(value: string) {
  return UNSAFE_MULTILINE_CONTROL.test(value);
}

/**
 * Soft normalize for Daily Ops Ask Mise briefing selection. Preserves soft
 * empty → `null` (prior `.trim()` emptiness fallthrough) while refusing to
 * invent a clean briefing via Unicode em-space trim. Does not throw; unsafe
 * controls soft to `null` so report construction stays available.
 */
export function normalizeDailyOpsAskBriefingText(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those and omitted the briefing. Do not invent a one-character
  // briefing token.
  if (!value.trim()) return null;
  if (hasUnsafeMultilineControls(value)) return null;
  const prepared = canonicalDailyOpsAskBriefingText(value);
  if (!prepared) return null;
  return prepared;
}
