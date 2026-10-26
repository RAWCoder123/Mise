/**
 * Daily Brief recommended-action edit free-text helpers (MISE-005QX).
 *
 * Pins `components/dailyBrief/DailyBriefBoard.tsx` save-edit prep outside the
 * React Native screen graph so Node tests can exercise inventing proofs
 * without loading Expo. The prior path Unicode-trimmed the operator edit and
 * the current recommended action before the emptiness / unchanged / max-320
 * gates and the `submit("edited", next)` payload
 * (`'\u2003Order chicken before lunch service.\u2003'.trim() === 'Order chicken before lunch service.'`),
 * so NBSP / em-space padding invented equality with a clean free-text
 * recommended action before finding-decision feedback stored the edit.
 *
 * Recommended-action edits are multiline operator free-text (parity with open
 * MISE-005OX finding recommended-action domain / MISE-005QW shared-task
 * completion evidence note / MISE-005QS Ask Mise question / MISE-005QF Daily
 * Ops askBriefingText / MISE-005PT inventory-operation note): fold NBSP to a
 * plain space, then trim only C-locale `[[:space:]]` from the ends. Do not
 * collapse internal whitespace with `\s` or Unicode `String#trim`, so internal
 * LF/TAB/CR survive and em-space padding cannot invent equality with an
 * unpadded recommended action. Accents and case are preserved.
 *
 * Control gate matches the operator_note multiline allowlist: reject C0
 * controls and DEL except LF/TAB/CR. Full `[[:cntrl:]]` would reject the same
 * line breaks an operator may paste into the edit field.
 *
 * Soft empty after prep stays `null` so the Daily Brief edit UI keeps the
 * prior `.trim()` emptiness → invalid-edit error. Unsafe-control tokens also
 * soft to `null` on this interactive path so a bad paste cannot crash save.
 * Max length stays 320 to match the prior UI gate and open domain tip #832.
 *
 * Complements open finding recommended-action domain tip (#832 / MISE-005OX)
 * without sharing that module or rewriting domain `requireBoundedText` /
 * `requireCanonicalOperationalFindingEditedRecommendedAction` paths. Intentionally
 * leaves Approve / Dismiss paths alone and leaves evidence-summary tip #831
 * alone.
 */

const C_LEADING_WHITESPACE = /^[ \t\n\v\f\r]+/;
const C_TRAILING_WHITESPACE = /[ \t\n\v\f\r]+$/;
/** Allow LF/TAB/CR; reject other C0 controls and DEL (operator_note parity). */
const UNSAFE_MULTILINE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

export const DAILY_BRIEF_RECOMMENDED_ACTION_EDIT_MAX_CHARACTERS = 320;

/**
 * Canonical free-text for Daily Brief recommended-action edits. Folds NBSP,
 * C-whitespace-trims ends only. Does not Unicode-trim or collapse with `\s`, so
 * em-space padding cannot invent equality with an unpadded recommended action
 * and internal newlines stay intact.
 */
export function canonicalDailyBriefRecommendedActionEdit(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_LEADING_WHITESPACE, "")
    .replace(C_TRAILING_WHITESPACE, "");
}

function hasUnsafeMultilineControls(value: string) {
  return UNSAFE_MULTILINE_CONTROL.test(value);
}

/**
 * Soft normalize for Daily Brief save-edit. Preserves soft empty → `null`
 * (prior `.trim()` emptiness → invalid-edit error) while refusing to invent a
 * clean recommended action via Unicode em-space trim. Does not throw; unsafe
 * controls soft to `null` so the edit form stays available. Over-long tokens
 * after ASCII C prep also soft to `null` so the prior max-320 invalid path
 * remains.
 */
export function normalizeDailyBriefRecommendedActionEdit(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those into the invalid-edit error. Do not invent a one-character
  // recommended-action token.
  if (!value.trim()) return null;
  if (hasUnsafeMultilineControls(value)) return null;
  const prepared = canonicalDailyBriefRecommendedActionEdit(value);
  if (!prepared) return null;
  if (prepared.length > DAILY_BRIEF_RECOMMENDED_ACTION_EDIT_MAX_CHARACTERS) {
    return null;
  }
  return prepared;
}
