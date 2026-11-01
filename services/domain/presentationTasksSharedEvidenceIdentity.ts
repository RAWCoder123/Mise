/**
 * Shared-task completion evidence `tasks.shared.evidence` display helpers
 * (MISE-005VS).
 *
 * Pins the Task detail completed-evidence branch that previously selected
 * display text with nullish coalescing before the intentional localized
 * fallback:
 * `entry.note ?? entry.label ?? entry.type ?? t("tasks.shared.evidence")`.
 *
 * A Unicode-only-space note (`"\u2003"`) is non-nullish
 * (`("\u2003" ?? FALLBACK) === "\u2003"`), so the intentional
 * `tasks.shared.evidence` copy was bypassed (and the label/type candidates
 * were never consulted). Empty string has the same `??` bypass
 * (`("" ?? FALLBACK) === ""`). The same bypass applies when `note` is absent
 * and `label` or `type` alone is Unicode-only space or empty. Separately,
 * Unicode `.trim()` on padded evidence notes
 * (`"\u2003Counted walk-in\u2003".trim() === "Counted walk-in"`) would invent
 * a clean display body if that gate Unicode-trimmed before rendering into the
 * completed-evidence section.
 *
 * Evidence display tokens are multiline free-text (parity with open
 * instructions tip #1025 / MISE-005VQ, Orders detail note.none #1013 /
 * MISE-005VE, and write-path completion evidence notes #883 / MISE-005QW):
 * fold NBSP to a plain space, then trim only C-locale `[[:space:]]` from the
 * ends. Do not collapse internal whitespace with `\s` or Unicode
 * `String#trim`, so internal LF/TAB/CR survive and em-space padding cannot
 * invent equality with an unpadded evidence body. Accents and case are
 * preserved.
 *
 * Control gate matches the operator_note multiline allowlist: reject C0
 * controls and DEL except LF/TAB/CR. Full `[[:cntrl:]]` would reject the same
 * line breaks operators may paste into verification evidence.
 *
 * These are presentation **tasks.shared.evidence** display tokens only — not
 * the write-path completion evidence note prep owned by #883, not Task detail
 * instructions → `tasks.shared.noInstructions` (#1025), not checklist
 * label/type → `tasks.shared.checklistItem` (#1026), not domain create/hydrate
 * detail (#823), not `completionResult` (#824), not Create Task UI
 * body/detail pass-through, and not the completion write-path English
 * `"Completed checklist item"` hardcode. Soft empty / Unicode-padded /
 * control-bearing tokens soft-null so the live
 * `|| t("tasks.shared.evidence")` branch owns the intentional localized
 * fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1026 / #1025 / #883 / #823 / #824 on related free-text /
 * checklist paths without sharing those modules or rewriting their call
 * sites.
 */

const C_LEADING_WHITESPACE = /^[ \t\n\v\f\r]+/;
const C_TRAILING_WHITESPACE = /[ \t\n\v\f\r]+$/;
/** Allow LF/TAB/CR; reject other C0 controls and DEL (operator_note parity). */
const UNSAFE_MULTILINE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/**
 * ASCII C multiline free-text prep for tasks.shared.evidence display.
 * Folds NBSP, C-whitespace-trims ends only. Does not Unicode-trim or collapse
 * with `\s`, so em-space padding cannot invent a clean evidence body and
 * internal newlines stay intact.
 */
export function asciiPrepTasksSharedEvidence(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_LEADING_WHITESPACE, "")
    .replace(C_TRAILING_WHITESPACE, "");
}

function hasUnsafeMultilineControls(value: string) {
  return UNSAFE_MULTILINE_CONTROL.test(value);
}

/**
 * Canonicalize a Task detail evidence note/label/type display token under
 * ASCII C multiline prep. Returns null when empty after prep, still
 * Unicode-padded, or containing disallowed controls.
 */
export function canonicalizeTasksSharedEvidence(value: string): string | null {
  const prepared = asciiPrepTasksSharedEvidence(value);
  if (!prepared) return null;
  // Fail closed when Unicode trim would still strip end padding (em-space).
  if (prepared !== prepared.trim()) return null;
  if (hasUnsafeMultilineControls(prepared)) return null;
  return prepared;
}

/**
 * Soft normalize one Task detail evidence note, label, or type candidate.
 * Preserves soft empty → null (intentional localized tasks.shared.evidence
 * copy) while refusing to invent a clean evidence body via Unicode em-space
 * trim. Does not throw; Unicode-padded / unsafe / non-string tokens return
 * null so the live `|| t("tasks.shared.evidence")` branch owns the fallback
 * without inventing a clean evidence identity from padding, and without
 * letting non-nullish Unicode-only space or empty string bypass that fallback
 * through the prior `??` cascade.
 */
export function normalizeTasksSharedEvidence(
  value: string | null | undefined | unknown
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously bypassed the intentional localized tasks.shared.evidence copy
  // via `??`. Do not invent a clean evidence body from padding.
  if (!value.trim()) return null;
  return canonicalizeTasksSharedEvidence(value);
}
