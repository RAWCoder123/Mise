/**
 * Daily Ops signal-line insight free-text helpers (MISE-005QG).
 *
 * Pins `pickSignalLine` insight `recommended_action` / `why_it_matters` prep
 * outside the repository graph so Node tests can exercise inventing proofs
 * without loading Supabase or AsyncStorage. The prior path Unicode-trimmed
 * those insight fields before composing the Daily Ops closeout signal line
 * (`'\u2003Special the herbs tonight\u2003'.trim() === 'Special the herbs tonight'`).
 *
 * Insight recommended-action and why-it-matters tokens are multiline operator /
 * system free-text (parity with open MISE-005QF Daily Ops askBriefingText /
 * MISE-005QE operating-plan why / MISE-005PT inventory-operation note /
 * MISE-005PF supplier operator_note): fold NBSP to a plain space, then trim
 * only C-locale `[[:space:]]` from the ends. Do not collapse internal
 * whitespace with `\s` or Unicode `String#trim`, so internal LF/TAB/CR survive
 * and em-space padding cannot invent equality with an unpadded action/why.
 * Accents and case are preserved.
 *
 * Control gate matches the operator_note multiline allowlist: reject C0
 * controls and DEL except LF/TAB/CR. Full `[[:cntrl:]]` would reject the same
 * line breaks operators need in insight prose.
 *
 * Soft empty after prep stays `null` so signal-line selection can fall through
 * to the next authoritative source (`why`, then `description` / `title`).
 * Unsafe-control tokens also soft to `null` on this read-side projection so a
 * bad insight string cannot crash Daily Ops report construction (fail-closed
 * persist tips own throw contracts elsewhere). No new max-length bound is
 * introduced; the prior helper did not truncate.
 *
 * Complements open Daily Ops askBriefingText tip (#866) and finding
 * recommendedAction tip (#832) without sharing those modules or rewriting
 * `askBriefingText?.trim()` / finding `recommendedAction` on main. Those
 * remain on their existing contracts in this tip.
 */

const C_LEADING_WHITESPACE = /^[ \t\n\v\f\r]+/;
const C_TRAILING_WHITESPACE = /[ \t\n\v\f\r]+$/;
/** Allow LF/TAB/CR; reject other C0 controls and DEL (operator_note parity). */
const UNSAFE_MULTILINE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/**
 * Canonical free-text for Daily Ops signal-line insight tokens. Folds NBSP,
 * C-whitespace-trims ends only. Does not Unicode-trim or collapse with `\s`, so
 * em-space padding cannot invent equality with an unpadded action/why and
 * internal newlines stay intact.
 */
export function canonicalDailyOpsSignalLineText(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_LEADING_WHITESPACE, "")
    .replace(C_TRAILING_WHITESPACE, "");
}

function hasUnsafeMultilineControls(value: string) {
  return UNSAFE_MULTILINE_CONTROL.test(value);
}

/**
 * Soft normalize for Daily Ops `pickSignalLine` insight `recommended_action` /
 * `why_it_matters` selection. Preserves soft empty → `null` (prior `.trim()`
 * emptiness fallthrough) while refusing to invent a clean action/why via
 * Unicode em-space trim. Does not throw; unsafe controls soft to `null` so
 * report construction stays available.
 */
export function normalizeDailyOpsSignalLineText(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those and fell through. Do not invent a one-character token.
  if (!value.trim()) return null;
  if (hasUnsafeMultilineControls(value)) return null;
  const prepared = canonicalDailyOpsSignalLineText(value);
  if (!prepared) return null;
  return prepared;
}
