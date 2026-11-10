/**
 * Task detail shared-task `completionResult` display helpers (MISE-005ABM).
 *
 * Pins the Task detail completed-result body that previously always-passed the
 * raw shared-task token into Text:
 *   <Text style={styles.instructionsBody}>{sharedTask.completionResult}</Text>
 *
 * Domain hydrate uses Unicode `.trim()` via `optionalText`, and the complete
 * path uses `.trim().replace(/\s+/g, " ")` via `requiredText`, so em-space
 * padding invents a clean result body before UI
 * (`"\u2003Counted 18 lb\u2003".trim() === "Counted 18 lb"`;
 * `"\u2003Counted 18 lb\u2003".trim().replace(/\s+/g, " ") === "Counted 18 lb"`).
 * Separately, Unicode-only-space / control-bearing tokens that survive soft
 * upstream paths always-pass into blank-looking or control-bearing Result
 * chrome under `tasks.shared.result` with no hide branch.
 *
 * Completion results are multiline free-text (parity with open restaurant-
 * tasks domain completionResult tip #824 / MISE-005OP, Operating Plan
 * Timeline completionResult #1223 / MISE-005ABL, Orders detail
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
 * These are presentation **Task detail sharedTask.completionResult** display
 * tokens only — not domain restaurant-tasks durable complete/hydrate
 * completionResult (#824 / MISE-005OP), not Operating Plan Timeline
 * presentation.completionResult (#1223 / MISE-005ABL), not Task detail
 * instructions → tasks.shared.noInstructions (#1025 / MISE-005VQ), not
 * completion evidence notes (#883 / #1027), and not Create Task UI body
 * pass-through. Soft empty / Unicode-padded / control-bearing tokens soft-null
 * so an intentional hide owns the empty state instead of inventing a clean
 * result body via Unicode trim. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #824 / #1025 / #1223 without sharing those modules or
 * rewriting their call sites. Alone-OK: #824 may still land domain write
 * canonicalize later; this tip soft-nulls padding at the Task detail UI gate
 * instead of inventing a clean result body, and also covers the always-pass
 * completed-result Text that #824 / #1223 do not own. Ordinary conflict only
 * on `app/tasks/[id].tsx` beside #1025.
 */

const C_LEADING_WHITESPACE = /^[ \t\n\v\f\r]+/;
const C_TRAILING_WHITESPACE = /[ \t\n\v\f\r]+$/;
/** Allow LF/TAB/CR; reject other C0 controls and DEL (operator_note parity). */
const UNSAFE_MULTILINE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/**
 * ASCII C multiline free-text prep for Task detail sharedTask.completionResult.
 * Folds NBSP, C-whitespace-trims ends only. Does not Unicode-trim or collapse
 * with `\s`, so em-space padding cannot invent a clean result body and internal
 * newlines stay intact.
 */
export function asciiPrepTaskDetailCompletionResult(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_LEADING_WHITESPACE, "")
    .replace(C_TRAILING_WHITESPACE, "");
}

function hasUnsafeMultilineControls(value: string) {
  return UNSAFE_MULTILINE_CONTROL.test(value);
}

/**
 * Canonicalize a Task detail completionResult display token under ASCII C
 * multiline prep. Returns null when empty after prep, still Unicode-padded,
 * or containing disallowed controls.
 */
export function canonicalizeTaskDetailCompletionResult(
  value: string
): string | null {
  const prepared = asciiPrepTaskDetailCompletionResult(value);
  if (!prepared) return null;
  // Fail closed when Unicode trim would still strip end padding (em-space).
  if (prepared !== prepared.trim()) return null;
  if (hasUnsafeMultilineControls(prepared)) return null;
  return prepared;
}

/**
 * Soft normalize one Task detail sharedTask.completionResult display
 * candidate. Preserves soft empty → null (intentional hide branch) while
 * refusing to invent a clean result body via Unicode em-space trim. Does not
 * throw; Unicode-padded / unsafe / non-string tokens return null so the live
 * completed-result Text owns the empty state without inventing a clean Task
 * detail result identity from padding, and without always-passing raw truthy
 * Unicode-only space into blank-looking Result chrome.
 */
export function normalizeTaskDetailCompletionResult(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): raw truthy padding
  // previously always-passed into blank-looking Result chrome.
  if (!value.trim()) return null;
  return canonicalizeTaskDetailCompletionResult(value);
}
