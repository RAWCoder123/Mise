/**
 * Operating Plan Timeline `presentation.completionResult` display helpers
 * (MISE-005ABL).
 *
 * Pins the Today OperatingPlanTimeline result line that previously selected
 * display text with raw truthiness and always-passed the raw token into the
 * localized interpolate:
 *   isDone && presentation.completionResult
 *     ? t("today.plan.result", { result: presentation.completionResult })
 *     : null
 *
 * A Unicode-only-space result (`"\u2003"`) is raw-truthy
 * (`Boolean("\u2003") === true`) while `.trim()` empties it, so the intentional
 * hide branch was bypassed and timeline chrome could render a blank-looking
 * `Result:  ` line. Separately, domain `completionResultForTask` Unicode-trims
 * matched activity `summary` / `title` before projecting into the plan item
 * (`"\u2003Counted 18 lb\u2003".trim() === "Counted 18 lb"`), inventing a clean
 * result body into presentation. Shared restaurant-task projection also feeds
 * raw `task.completionResult` through the same chrome. Control-bearing results
 * that survive upstream soft paths can likewise reach the always-pass
 * interpolate.
 *
 * Completion results are multiline free-text (parity with open restaurant-
 * tasks domain completionResult tip #824 / MISE-005OP, Orders detail
 * deliveryEvidence notes #1208 / MISE-005AAW, and operator_note-style
 * allowlists): fold NBSP to a plain space, then trim only C-locale
 * `[[:space:]]` from the ends. Do not collapse internal whitespace with `\s`
 * or Unicode `String#trim`, so internal LF/TAB/CR survive and em-space padding
 * cannot invent equality with an unpadded result. Accents and case are
 * preserved.
 *
 * Control gate matches the operator_note multiline allowlist: reject C0
 * controls and DEL except LF/TAB/CR. Full `[[:cntrl:]]` would reject the same
 * line breaks operators need in completion prose.
 *
 * These are presentation **Operating Plan Timeline completionResult** display
 * tokens only — not domain `completionResultForTask` assembly / why text
 * (#865), not restaurant-tasks durable complete/hydrate completionResult
 * (#824 / MISE-005OP), not task detail shared-task completionResult body
 * (`app/tasks/[id].tsx`, left alone by #1025), not Timeline display
 * presentation.title (#1161 / MISE-005ZC), not Timeline a11y title/detail
 * (#1077 / #1078), and not Activity title/summary tips (#1148–#1151). Soft
 * empty / Unicode-padded / control-bearing tokens soft-null so the live
 * truthiness hide branch owns the intentional empty state. Ordinary ASCII
 * whitespace still trims clean.
 *
 * Complements open #824 / #1161 / #1077 / #1078 without sharing those modules
 * or rewriting their call sites. Alone-OK: #824 may still land domain write
 * canonicalize later; this tip soft-nulls padding at the Timeline UI gate
 * instead of inventing a clean result body, and also covers the activity-
 * summary Unicode-trim inventing path that #824 does not own.
 */

const C_LEADING_WHITESPACE = /^[ \t\n\v\f\r]+/;
const C_TRAILING_WHITESPACE = /[ \t\n\v\f\r]+$/;
/** Allow LF/TAB/CR; reject other C0 controls and DEL (operator_note parity). */
const UNSAFE_MULTILINE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/**
 * ASCII C multiline free-text prep for Operating Plan Timeline
 * presentation.completionResult. Folds NBSP, C-whitespace-trims ends only.
 * Does not Unicode-trim or collapse with `\s`, so em-space padding cannot
 * invent a clean result body and internal newlines stay intact.
 */
export function asciiPrepOperatingPlanTimelineCompletionResult(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_LEADING_WHITESPACE, "")
    .replace(C_TRAILING_WHITESPACE, "");
}

function hasUnsafeMultilineControls(value: string) {
  return UNSAFE_MULTILINE_CONTROL.test(value);
}

/**
 * Canonicalize a Timeline completionResult display token under ASCII C
 * multiline prep. Returns null when empty after prep, still Unicode-padded,
 * or containing disallowed controls.
 */
export function canonicalizeOperatingPlanTimelineCompletionResult(
  value: string
): string | null {
  const prepared = asciiPrepOperatingPlanTimelineCompletionResult(value);
  if (!prepared) return null;
  // Fail closed when Unicode trim would still strip end padding (em-space).
  if (prepared !== prepared.trim()) return null;
  if (hasUnsafeMultilineControls(prepared)) return null;
  return prepared;
}

/**
 * Soft normalize one Operating Plan Timeline completionResult display
 * candidate. Preserves soft empty → null (intentional hide branch) while
 * refusing to invent a clean result body via Unicode em-space trim. Does not
 * throw; Unicode-padded / unsafe / non-string tokens return null so the live
 * truthiness gate owns the empty state without inventing a clean Timeline
 * result identity from padding, and without letting raw truthy Unicode-only
 * space bypass that hide into `today.plan.result`.
 */
export function normalizeOperatingPlanTimelineCompletionResult(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): raw truthy padding
  // previously bypassed the intentional hide branch into today.plan.result.
  if (!value.trim()) return null;
  return canonicalizeOperatingPlanTimelineCompletionResult(value);
}
