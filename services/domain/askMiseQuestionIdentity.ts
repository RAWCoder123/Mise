/**
 * Ask Mise operator-question free-text helpers (MISE-005QS).
 *
 * Pins `app/ask-mise.tsx` chat `ask()` question prep outside the React Native
 * screen graph so Node tests can exercise inventing proofs without loading
 * Expo. The prior path Unicode-trimmed the operator question before emptiness
 * checks, chat transcript storage, and `answerAskMise`
 * (`'\u2003What stock is low?\u2003'.trim() === 'What stock is low?'`), so
 * NBSP / em-space padding invented equality with a clean Ask Mise question
 * token.
 *
 * Ask Mise questions are multiline operator free-text (parity with open
 * MISE-005QF Daily Ops askBriefingText / MISE-005QE operating-plan why /
 * MISE-005QN outreach draft requireBoundedText / MISE-005PT inventory-operation
 * note): fold NBSP to a plain space, then trim only C-locale `[[:space:]]`
 * from the ends. Do not collapse internal whitespace with `\s` or Unicode
 * `String#trim`, so internal LF/TAB/CR survive and em-space padding cannot
 * invent equality with an unpadded question. Accents and case are preserved.
 *
 * Control gate matches the operator_note multiline allowlist: reject C0
 * controls and DEL except LF/TAB/CR. Full `[[:cntrl:]]` would reject the same
 * line breaks an operator may paste into Ask Mise.
 *
 * Soft empty after prep stays `null` so the Ask Mise UI keeps the prior
 * `.trim()` emptiness early-return (do not ask). Unsafe-control tokens also
 * soft to `null` on this interactive path so a bad paste cannot crash the
 * chat send. No new max-length bound is introduced; the prior helper did not
 * truncate.
 *
 * Complements open Ask Mise intent-classify tip (#700 / MISE-005KE) without
 * sharing that module or rewriting intent classification / Kelvin case-fold
 * on main. Those remain on their existing contracts in this tip. Does not tip
 * greeting `user?.name?.trim()` (#849) or send-button emptiness-only
 * `input.trim()` checks.
 */

const C_LEADING_WHITESPACE = /^[ \t\n\v\f\r]+/;
const C_TRAILING_WHITESPACE = /[ \t\n\v\f\r]+$/;
/** Allow LF/TAB/CR; reject other C0 controls and DEL (operator_note parity). */
const UNSAFE_MULTILINE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/**
 * Canonical free-text for Ask Mise operator-question tokens. Folds NBSP,
 * C-whitespace-trims ends only. Does not Unicode-trim or collapse with `\s`, so
 * em-space padding cannot invent equality with an unpadded question and
 * internal newlines stay intact.
 */
export function canonicalAskMiseQuestionText(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_LEADING_WHITESPACE, "")
    .replace(C_TRAILING_WHITESPACE, "");
}

function hasUnsafeMultilineControls(value: string) {
  return UNSAFE_MULTILINE_CONTROL.test(value);
}

/**
 * Soft normalize for Ask Mise chat send. Preserves soft empty → `null` (prior
 * `.trim()` emptiness early-return) while refusing to invent a clean question
 * via Unicode em-space trim. Does not throw; unsafe controls soft to `null` so
 * the chat UI stays available.
 */
export function normalizeAskMiseQuestion(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those into the ask early-return. Do not invent a one-character
  // question token.
  if (!value.trim()) return null;
  if (hasUnsafeMultilineControls(value)) return null;
  const prepared = canonicalAskMiseQuestionText(value);
  if (!prepared) return null;
  return prepared;
}
