/**
 * Recalculation-schedule failure-reason free-text helpers (MISE-005SO).
 *
 * Pins domain-layer `buildRecalculationSchedule` / `decideCycle`
 * `normalizeFailureReason` prep outside the full schedule graph so Node tests
 * can exercise inventing proofs without loading transport or application
 * siblings. Failed-run `failureReason` values previously Unicode-trimmed
 * before becoming durable operator-facing `lastFailureReason` (and before
 * embedding into decision `reason` copy), so NBSP / em-space padding invented
 * equality with a clean diagnostic
 * (`'\u2003Timeout while projecting inventory.\u2003'.trim() ===
 * 'Timeout while projecting inventory.'`).
 *
 * Schedule failure reasons are multiline system free-text (parity with open
 * MISE-005QE operating-plan why / MISE-005PT inventory-operation note): fold
 * NBSP to a plain space, then trim only C-locale `[[:space:]]` from the ends.
 * Do not collapse internal whitespace with `\s` or Unicode `String#trim`, so
 * internal LF/TAB/CR survive and em-space padding cannot invent equality with
 * an unpadded failure reason. Accents and case are preserved.
 *
 * Control gate matches the operator_note multiline allowlist: reject C0
 * controls and DEL except LF/TAB/CR. Full `[[:cntrl:]]` would reject the same
 * line breaks system error messages may carry before open write-side
 * sanitizer tip #555 / MISE-005EQ lands.
 *
 * Soft empty after prep stays `null` so the prior
 * `normalizeFailureReason` emptiness → `null` contract (and the
 * "No failure reason was recorded." fallthrough in dead-letter / backoff
 * copy) is preserved. Unsafe-control tokens also soft to `null` on this
 * read-side projection so a bad ledger row cannot crash schedule
 * construction. Max length stays 200 to match the prior
 * `.trim().slice(0, 200)` bound.
 *
 * Complements open recalculation-schedule restaurant tip (#733 / MISE-005LC),
 * timezone tip (#788 / MISE-005NF), run-transport restaurant tip (#734 /
 * MISE-005LD), scheduled-recalculation restaurant tip (#735 / MISE-005LE),
 * and failure_reason cntrl CHECK tip (#555 / MISE-005EQ) without sharing
 * those modules or rewriting those paths. Intentionally leaves application
 * `describeError` Unicode-trim haystacks in `recalculationCycles` /
 * `recalculationPorts`, activity-event `failureReason` pass-through, and
 * transport `p_failure_reason` pass-through alone.
 */

const C_LEADING_WHITESPACE = /^[ \t\n\v\f\r]+/;
const C_TRAILING_WHITESPACE = /[ \t\n\v\f\r]+$/;
/** Allow LF/TAB/CR; reject other C0 controls and DEL (operator_note parity). */
const UNSAFE_MULTILINE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/** Prior `normalizeFailureReason` / ledger length bound. */
export const RECALCULATION_SCHEDULE_FAILURE_REASON_MAX_CHARACTERS = 200;

/**
 * Canonical free-text for recalculation-schedule failure reasons. Folds NBSP,
 * C-whitespace-trims ends only. Does not Unicode-trim or collapse with `\s`, so
 * em-space padding cannot invent equality with an unpadded failure reason and
 * internal newlines stay intact.
 */
export function canonicalRecalculationScheduleFailureReason(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_LEADING_WHITESPACE, "")
    .replace(C_TRAILING_WHITESPACE, "");
}

function hasUnsafeMultilineControls(value: string) {
  return UNSAFE_MULTILINE_CONTROL.test(value);
}

/**
 * Soft normalize for schedule `lastFailureReason` projection. Preserves soft
 * empty → `null` (prior `.trim()` emptiness) while refusing to invent a clean
 * diagnostic via Unicode em-space trim. Does not throw; unsafe controls soft
 * to `null` so schedule construction stays available. Truncates to the prior
 * 200-character bound after ASCII C prep rather than after inventing Unicode
 * trim.
 */
export function normalizeRecalculationScheduleFailureReason(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those into null. Do not invent a one-character failure reason.
  if (!value.trim()) return null;
  if (hasUnsafeMultilineControls(value)) return null;
  const prepared = canonicalRecalculationScheduleFailureReason(value);
  if (!prepared) return null;
  return prepared.slice(0, RECALCULATION_SCHEDULE_FAILURE_REASON_MAX_CHARACTERS);
}
