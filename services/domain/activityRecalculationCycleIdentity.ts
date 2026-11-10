/**
 * Activity recalculation-run cycle identity helpers (MISE-005ABW).
 *
 * Pins the demo Activity emission path in
 * `fromRecalculationRunActivity` that previously always-passed raw
 * `run.cycle` into operator-facing failure summary copy with only
 * underscore→space humanize and no prep gate:
 *
 * ```text
 * `Attempt ${run.attempt} of the ${run.cycle.replace(/_/g, " ")} recalculation did not complete. …`
 * ```
 *
 * A Unicode-only-space cycle (`"\u2003"`) is a non-empty string, so
 * Activity still rendered blank-looking cycle identity
 * (`"Attempt N of the   recalculation…"`). Separately, Unicode `.trim()`
 * on a padded cycle (`"\u2003daily_open\u2003".trim() === "daily_open"`)
 * would invent a clean display cycle if that gate Unicode-trimmed before
 * interpolating into Activity summary copy (and before underscore→space
 * humanize).
 *
 * Single-line cycle tips use ASCII end trim only and preserve NBSP (no
 * fold into plain space). Soft-null when Unicode trim would still strip
 * end padding (NBSP / em-space) so padding cannot invent equality with
 * an unpadded cycle. Accents and case are preserved. Full C0/DEL control
 * rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **Activity recalculation cycle** tokens only —
 * the failure-summary cycle label that soft-nulls back to the intentional
 * `"unknown"` fallthrough when unsafe. Not Activity recalculation
 * failureReason (#1232 / MISE-005ABV), not recalculation-schedule
 * failure-reason prep (#927 / MISE-005SO), not application
 * `describeError` haystacks (#928 / MISE-005SP), not transport
 * `p_failure_reason`, not write-side cntrl sanitizer (#555 / MISE-005EQ),
 * not Activity title/summary i18n (#271), not metadata.cycle /
 * sequenceId / success-emission gate authority that still consume raw
 * `run.cycle`, and not Restaurant Memory `convertMemoryToRule` title
 * humanize (after #1230 lands). Soft empty / Unicode-padded /
 * control-bearing tokens soft-null so the live `"unknown"` fallthrough
 * owns the intentional blank-cycle fallback without inventing a clean
 * Activity recalculation cycle from padding, and without letting
 * Unicode-only space render blank-looking cycle identity through the
 * prior always-pass path. Ordinary ASCII whitespace still trims clean.
 * Underscore→space humanize remains a post-normalize presentation step
 * on the safe token only.
 *
 * Complements open #1232 / #927 / #928 / #555 / #271 without sharing
 * those modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Activity recalculation cycle before it
 * is rendered into failure-summary copy.
 */
export function asciiTrimActivityRecalculationCycle(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an Activity recalculation cycle under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeActivityRecalculationCycle(value: string): string | null {
  const trimmed = asciiTrimActivityRecalculationCycle(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Activity `fromRecalculationRunActivity` cycle
 * interpolation. Preserves soft empty → null (intentional `"unknown"`
 * fallthrough) while refusing to invent a clean cycle via Unicode
 * em-space / NBSP trim. Does not throw; Unicode-padded / unsafe /
 * non-string tokens return null so the live `"unknown"` branch owns the
 * fallback without inventing a clean Activity recalculation cycle from
 * padding, and without letting Unicode-only space render blank-looking
 * cycle identity through the prior always-pass summary path.
 */
export function normalizeActivityRecalculationCycle(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-empty padding
  // previously still rendered into Activity failure-summary copy as a
  // blank-looking cycle identity.
  // Do not invent a clean Activity recalculation cycle from padding.
  if (!value.trim()) return null;
  return canonicalizeActivityRecalculationCycle(value);
}
