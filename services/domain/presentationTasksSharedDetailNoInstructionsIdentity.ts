/**
 * Shared-task detail `tasks.shared.noInstructions` display helpers (MISE-005VQ).
 *
 * Pins the Task detail instructions branch that previously selected display
 * text with nullish coalescing before the intentional localized fallback:
 * `sharedTask.detail ?? t("tasks.shared.noInstructions")`.
 *
 * A Unicode-only-space detail (`"\u2003"`) is non-nullish
 * (`("\u2003" ?? FALLBACK) === "\u2003"`), so the intentional
 * `tasks.shared.noInstructions` copy was bypassed and task chrome could render
 * a blank-looking instructions body. Empty string has the same `??` bypass
 * (`("" ?? FALLBACK) === ""`). Separately, Unicode `.trim()` on padded detail
 * (`"\u2003Count the walk-in case.\u2003".trim() === "Count the walk-in case."`)
 * would invent a clean display body if that gate Unicode-trimmed before
 * rendering into the instructions section.
 *
 * Task detail is multiline free-text (parity with open domain tip #823 /
 * MISE-005OO and Orders detail note.none #1013 / MISE-005VE): fold NBSP to a
 * plain space, then trim only C-locale `[[:space:]]` from the ends. Do not
 * collapse internal whitespace with `\s` or Unicode `String#trim`, so internal
 * LF/TAB/CR survive and em-space padding cannot invent equality with an
 * unpadded detail body. Accents and case are preserved.
 *
 * Control gate matches the operator_note multiline allowlist: reject C0
 * controls and DEL except LF/TAB/CR. Full `[[:cntrl:]]` would reject the same
 * line breaks operators need in task instructions.
 *
 * These are presentation **tasks.shared.noInstructions** display tokens only —
 * not the domain create/hydrate `detail` path owned by #823, not completion
 * evidence notes (#883), not checklist `label`/`type` fallbacks, not
 * `completionResult` (#824), and not Create Task UI body/detail pass-through.
 * Soft empty / Unicode-padded / control-bearing tokens soft-null so the live
 * `|| t("tasks.shared.noInstructions")` branch owns the intentional localized
 * fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #823 / #883 / #824 / #1013 on related free-text paths
 * without sharing those modules or rewriting their call sites.
 */

const C_LEADING_WHITESPACE = /^[ \t\n\v\f\r]+/;
const C_TRAILING_WHITESPACE = /[ \t\n\v\f\r]+$/;
/** Allow LF/TAB/CR; reject other C0 controls and DEL (operator_note parity). */
const UNSAFE_MULTILINE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/**
 * ASCII C multiline free-text prep for tasks.shared.noInstructions display.
 * Folds NBSP, C-whitespace-trims ends only. Does not Unicode-trim or collapse
 * with `\s`, so em-space padding cannot invent a clean instructions body and
 * internal newlines stay intact.
 */
export function asciiPrepTasksSharedDetailNoInstructions(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_LEADING_WHITESPACE, "")
    .replace(C_TRAILING_WHITESPACE, "");
}

function hasUnsafeMultilineControls(value: string) {
  return UNSAFE_MULTILINE_CONTROL.test(value);
}

/**
 * Canonicalize a shared-task detail display token under ASCII C multiline prep.
 * Returns null when empty after prep, still Unicode-padded, or containing
 * disallowed controls.
 */
export function canonicalizeTasksSharedDetailNoInstructions(
  value: string
): string | null {
  const prepared = asciiPrepTasksSharedDetailNoInstructions(value);
  if (!prepared) return null;
  // Fail closed when Unicode trim would still strip end padding (em-space).
  if (prepared !== prepared.trim()) return null;
  if (hasUnsafeMultilineControls(prepared)) return null;
  return prepared;
}

/**
 * Soft normalize one tasks.shared.noInstructions display candidate.
 * Preserves soft empty → null (intentional localized
 * tasks.shared.noInstructions copy) while refusing to invent a clean
 * instructions body via Unicode em-space trim. Does not throw;
 * Unicode-padded / unsafe / non-string tokens return null so the live
 * `|| t("tasks.shared.noInstructions")` branch owns the fallback without
 * inventing a clean detail identity from padding, and without letting
 * non-nullish Unicode-only space or empty string bypass that fallback through
 * the prior `??` row.
 */
export function normalizeTasksSharedDetailNoInstructions(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously bypassed the intentional localized tasks.shared.noInstructions
  // copy via `??`. Do not invent a clean instructions body from padding.
  if (!value.trim()) return null;
  return canonicalizeTasksSharedDetailNoInstructions(value);
}
