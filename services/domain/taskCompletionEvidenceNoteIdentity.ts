/**
 * Shared-task completion evidence-note free-text helpers (MISE-005QW).
 *
 * Pins `app/tasks/[id].tsx` `completeSharedTask()` evidence-note prep outside
 * the React Native screen graph so Node tests can exercise inventing proofs
 * without loading Expo. The prior path Unicode-trimmed the operator evidence
 * note before the required-evidence emptiness check and the
 * `completeSharedRestaurantTask` completionEvidence `note` payload
 * (`'\u2003Counted walk-in\u2003'.trim() === 'Counted walk-in'`), so NBSP /
 * em-space padding invented equality with a clean free-text evidence note
 * before restaurant-task completion evidence stored it.
 *
 * Completion evidence notes are multiline operator free-text (parity with
 * open MISE-005QS Ask Mise question / MISE-005QF Daily Ops askBriefingText /
 * MISE-005QE operating-plan why / MISE-005PT inventory-operation note /
 * MISE-005PE floor-notes body / MISE-005OP restaurant-tasks
 * completionResult): fold NBSP to a plain space, then trim only C-locale
 * `[[:space:]]` from the ends. Do not collapse internal whitespace with `\s`
 * or Unicode `String#trim`, so internal LF/TAB/CR survive and em-space
 * padding cannot invent equality with an unpadded evidence note. Accents and
 * case are preserved.
 *
 * Control gate matches the operator_note multiline allowlist: reject C0
 * controls and DEL except LF/TAB/CR. Full `[[:cntrl:]]` would reject the same
 * line breaks an operator may paste into the evidence field.
 *
 * Soft empty after prep stays `null` so the shared-task detail UI keeps the
 * prior `.trim()` emptiness → required-evidence error / omit optional note.
 * Unsafe-control tokens also soft to `null` on this interactive path so a bad
 * paste cannot crash complete. No new max-length bound is introduced; the
 * TextInput already caps at 500 characters and downstream evidence bounds stay
 * on their existing contracts.
 *
 * Complements open restaurant-tasks completionResult tip (#824 / MISE-005OP)
 * and evidence-type tip (#856 / MISE-005PV) without sharing those modules or
 * rewriting `completionResult.trim()` emptiness checks / domain
 * `boundedEvidence` type prep on this path. Intentionally leaves
 * `completionResult` on its existing Unicode emptiness gate + raw store (open
 * #824 owns durable completionResult ASCII C) and leaves checklist
 * completionEvidence labels alone.
 */

const C_LEADING_WHITESPACE = /^[ \t\n\v\f\r]+/;
const C_TRAILING_WHITESPACE = /[ \t\n\v\f\r]+$/;
/** Allow LF/TAB/CR; reject other C0 controls and DEL (operator_note parity). */
const UNSAFE_MULTILINE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/**
 * Canonical free-text for shared-task completion evidence notes. Folds NBSP,
 * C-whitespace-trims ends only. Does not Unicode-trim or collapse with `\s`, so
 * em-space padding cannot invent equality with an unpadded evidence note and
 * internal newlines stay intact.
 */
export function canonicalTaskCompletionEvidenceNote(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_LEADING_WHITESPACE, "")
    .replace(C_TRAILING_WHITESPACE, "");
}

function hasUnsafeMultilineControls(value: string) {
  return UNSAFE_MULTILINE_CONTROL.test(value);
}

/**
 * Soft normalize for shared-task complete evidence notes. Preserves soft
 * empty → `null` (prior `.trim()` emptiness → required error / omit optional
 * note) while refusing to invent a clean note via Unicode em-space trim. Does
 * not throw; unsafe controls soft to `null` so the complete form stays
 * available.
 */
export function normalizeTaskCompletionEvidenceNote(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those into the required-evidence error / omit path. Do not invent
  // a one-character evidence note token.
  if (!value.trim()) return null;
  if (hasUnsafeMultilineControls(value)) return null;
  const prepared = canonicalTaskCompletionEvidenceNote(value);
  if (!prepared) return null;
  return prepared;
}
