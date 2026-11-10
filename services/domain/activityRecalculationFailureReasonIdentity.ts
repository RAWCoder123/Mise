/**
 * Activity recalculation-run failureReason helpers (MISE-005ABV).
 *
 * Pins the demo Activity emission path in
 * `fromRecalculationRunActivity` that previously always-passed raw
 * `run.failureReason` into operator-facing summary copy and
 * `errorMessage`:
 *
 * ```text
 * `… recalculation did not complete. ${
 *   run.failureReason ?? "No failure reason was recorded."
 * }`
 * errorMessage: succeeded ? null : run.failureReason
 * ```
 *
 * A Unicode-only-space failure reason (`"\u2003"`) is a non-empty string,
 * so the `??` fallback was bypassed and Activity summaries could render a
 * blank-looking trailing diagnostic. Separately, Unicode `.trim()` on a
 * padded reason (`"\u2003Timeout…\u2003".trim() === "Timeout…"`) would
 * invent a clean diagnostic if that gate Unicode-trimmed before
 * interpolating into Activity summary / errorMessage copy.
 *
 * Activity recalculation failure reasons are multiline system free-text
 * (parity with open MISE-005SO schedule failure-reason prep): fold NBSP to
 * a plain space, then trim only C-locale `[[:space:]]` from the ends. Do
 * not collapse internal whitespace with `\s` or Unicode `String#trim`, so
 * internal LF/TAB/CR survive and em-space padding cannot invent equality
 * with an unpadded failure reason. Accents and case are preserved.
 *
 * Control gate matches the operator_note multiline allowlist: reject C0
 * controls and DEL except LF/TAB/CR.
 *
 * Soft empty after prep stays `null` so the intentional
 * `"No failure reason was recorded."` summary fallthrough (and null
 * `errorMessage`) is restored. Unsafe-control tokens also soft to `null`
 * on this Activity emission path so a bad run record cannot invent blank
 * or control-bearing Activity copy. No new length bound is introduced —
 * the prior Activity pass-through had none.
 *
 * Complements open recalculation-schedule failure-reason tip
 * (#927 / MISE-005SO) which explicitly left Activity-event
 * `failureReason` pass-through alone. Leaves cycle underscore-humanize
 * in the same summary template alone, application `describeError`
 * haystacks (#928 / MISE-005SP), transport `p_failure_reason`,
 * write-side cntrl sanitizer (#555 / MISE-005EQ), and Activity title /
 * summary i18n (#271) alone.
 */

const C_LEADING_WHITESPACE = /^[ \t\n\v\f\r]+/;
const C_TRAILING_WHITESPACE = /[ \t\n\v\f\r]+$/;
/** Allow LF/TAB/CR; reject other C0 controls and DEL (operator_note parity). */
const UNSAFE_MULTILINE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/**
 * Canonical free-text for Activity recalculation-run failure reasons.
 * Folds NBSP, C-whitespace-trims ends only. Does not Unicode-trim or
 * collapse with `\s`, so em-space padding cannot invent equality with an
 * unpadded failure reason and internal newlines stay intact.
 */
export function canonicalActivityRecalculationFailureReason(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_LEADING_WHITESPACE, "")
    .replace(C_TRAILING_WHITESPACE, "");
}

function hasUnsafeMultilineControls(value: string) {
  return UNSAFE_MULTILINE_CONTROL.test(value);
}

/**
 * Soft normalize for Activity `fromRecalculationRunActivity` failureReason
 * interpolation. Preserves soft empty → `null` so the intentional
 * `"No failure reason was recorded."` summary fallthrough (and null
 * `errorMessage`) owns the empty path, while refusing to invent a clean
 * diagnostic via Unicode em-space / NBSP trim. Does not throw;
 * Unicode-padded / unsafe / non-string tokens return null.
 */
export function normalizeActivityRecalculationFailureReason(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-empty padding
  // previously still bypassed `?? "No failure reason was recorded."`.
  // Do not invent a one-character Activity failure reason.
  if (!value.trim()) return null;
  if (hasUnsafeMultilineControls(value)) return null;
  const prepared = canonicalActivityRecalculationFailureReason(value);
  if (!prepared) return null;
  // Fail closed when Unicode trim would still strip end padding (em-space).
  // Em-space is not C-space, so canonical prep leaves it; soft-null so padding
  // cannot invent equality with an unpadded diagnostic.
  if (prepared !== prepared.trim()) return null;
  return prepared;
}
