/**
 * Recalculation-cycle describeError free-text helpers (MISE-005SP).
 *
 * Pins application-layer `describeError` prep outside the cycle runner so Node
 * tests can exercise inventing proofs without loading schedule or transport
 * siblings. Failed-cycle diagnostics previously Unicode-trimmed before becoming
 * durable operator-facing `failureReason` on the run ledger (and before
 * embedding into `scheduleError` / ledger-write failure copy), so NBSP /
 * em-space padding invented equality with a clean diagnostic
 * (`'\u2003Timeout while projecting inventory.\u2003'.trim() ===
 * 'Timeout while projecting inventory.'`).
 *
 * Describe-error haystacks are multiline system free-text (parity with open
 * MISE-005SO schedule failure reasons / MISE-005QE operating-plan why /
 * MISE-005PT inventory-operation note): fold NBSP to a plain space, then trim
 * only C-locale `[[:space:]]` from the ends. Do not collapse internal
 * whitespace with `\s` or Unicode `String#trim`, so internal LF/TAB/CR survive
 * and em-space padding cannot invent equality with an unpadded diagnostic.
 * Accents and case are preserved.
 *
 * Control gate matches the operator_note multiline allowlist: reject C0
 * controls and DEL except LF/TAB/CR. Full `[[:cntrl:]]` would reject the same
 * line breaks system error messages may carry before open write-side
 * sanitizer tip #555 / MISE-005EQ lands.
 *
 * Soft empty after prep falls through to the prior
 * `"Unknown recalculation failure"` fallback so the existing never-null
 * `describeError` contract is preserved. Unsafe-control tokens also soft to
 * that fallback so a bad Error.message cannot crash cycle reporting. Max
 * length stays 200 to match the prior `.trim().slice(0, 200)` bound.
 *
 * Complements open recalculation-schedule failure-reason tip (#927 /
 * MISE-005SO), schedule restaurant tip (#733 / MISE-005LC), timezone tip
 * (#788 / MISE-005NF), run-transport restaurant tip (#734 / MISE-005LD),
 * scheduled-recalculation restaurant tip (#735 / MISE-005LE), and
 * failure_reason cntrl CHECK tip (#555 / MISE-005EQ) without sharing those
 * modules or rewriting those paths. Intentionally leaves schedule
 * `normalizeRecalculationScheduleFailureReason`, activity-event
 * `failureReason` pass-through, and transport `p_failure_reason`
 * pass-through alone.
 */

const C_LEADING_WHITESPACE = /^[ \t\n\v\f\r]+/;
const C_TRAILING_WHITESPACE = /[ \t\n\v\f\r]+$/;
/** Allow LF/TAB/CR; reject other C0 controls and DEL (operator_note parity). */
const UNSAFE_MULTILINE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/** Prior `describeError` / ledger length bound. */
export const RECALCULATION_DESCRIBE_ERROR_MAX_CHARACTERS = 200;

/** Prior never-null fallback when the diagnostic is empty or unusable. */
export const RECALCULATION_DESCRIBE_ERROR_FALLBACK = "Unknown recalculation failure";

/**
 * Canonical free-text for recalculation describeError haystacks. Folds NBSP,
 * C-whitespace-trims ends only. Does not Unicode-trim or collapse with `\s`, so
 * em-space padding cannot invent equality with an unpadded diagnostic and
 * internal newlines stay intact.
 */
export function canonicalRecalculationDescribeError(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_LEADING_WHITESPACE, "")
    .replace(C_TRAILING_WHITESPACE, "");
}

function hasUnsafeMultilineControls(value: string) {
  return UNSAFE_MULTILINE_CONTROL.test(value);
}

/**
 * Soft normalize for describeError haystacks. Preserves soft empty → null
 * (prior `.trim()` emptiness → fallback) while refusing to invent a clean
 * diagnostic via Unicode em-space trim. Does not throw; unsafe controls soft
 * to null so cycle reporting stays available. Truncates to the prior
 * 200-character bound after ASCII C prep rather than after inventing Unicode
 * trim.
 */
export function normalizeRecalculationDescribeError(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those into the unknown-failure fallback. Do not invent a
  // one-character diagnostic.
  if (!value.trim()) return null;
  if (hasUnsafeMultilineControls(value)) return null;
  const prepared = canonicalRecalculationDescribeError(value);
  if (!prepared) return null;
  return prepared.slice(0, RECALCULATION_DESCRIBE_ERROR_MAX_CHARACTERS);
}

/**
 * Never-null describeError projection used by the cycle runner. Soft empty /
 * unsafe / non-string fall through to the prior unknown-failure fallback.
 */
export function describeRecalculationError(error: unknown): string {
  if (error instanceof Error) {
    const prepared = normalizeRecalculationDescribeError(error.message);
    if (prepared) return prepared;
  } else if (typeof error === "string") {
    const prepared = normalizeRecalculationDescribeError(error);
    if (prepared) return prepared;
  }
  return RECALCULATION_DESCRIBE_ERROR_FALLBACK;
}
