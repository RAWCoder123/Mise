/**
 * Shared-task checklist completion-evidence label write helpers
 * (MISE-005VT).
 *
 * Pins the Task detail completion write path that previously baked English
 * UI copy (or a machine type code) into durable evidence labels:
 * `entry.label ?? entry.type ?? "Completed checklist item"`.
 *
 * A Unicode-only-space label (`"\u2003"`) is non-nullish
 * (`("\u2003" ?? FALLBACK) === "\u2003"`), so the intentional omit / localized
 * presentation path was bypassed and padding was stored as a durable label.
 * Empty string has the same `??` bypass (`("" ?? FALLBACK) === ""`). When
 * `label` is absent, the prior cascade promoted `entry.type` (for example
 * `"checklist_item"`) into the stored label, or invented English
 * `"Completed checklist item"`. Separately, Unicode `.trim()` on padded
 * labels (`"\u2003Walk-in count\u2003".trim() === "Walk-in count"`) would
 * invent a clean durable label if that gate Unicode-trimmed before write.
 *
 * Single-line checklist evidence labels use ASCII end trim only and preserve
 * NBSP (no fold into plain space). Soft-null when Unicode trim would still
 * strip end padding (NBSP / em-space) so padding cannot invent equality with
 * an unpadded operator label. Accents and case are preserved. Full C0/DEL
 * control rejection applies (no LF/TAB/CR allowlist); multiline free-text
 * completion evidence notes stay on open #883, and Task detail checklist /
 * evidence / instructions display stay on open #1026 / #1027 / #1025.
 *
 * These are **write-path** checklist completion-evidence label tokens only —
 * not Task detail checklist label/type → `tasks.shared.checklistItem`
 * presentation (#1026), not evidence `note`/`label`/`type` →
 * `tasks.shared.evidence` presentation (#1027), not Task detail instructions
 * → `tasks.shared.noInstructions` (#1025), not domain create/hydrate detail
 * (#823), not completion evidence notes (#883), not `completionResult`
 * (#824), and not Create Task UI body/detail pass-through. Soft empty /
 * Unicode-padded / control-bearing tokens soft-null so the write omits
 * `label` entirely rather than inventing English UI copy or promoting a
 * machine type. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1027 / #1026 / #1025 / #883 / #823 / #824 and supersedes
 * stale #268 (Unicode-trim inventing presentation helper) without sharing
 * those modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized checklist evidence label before it is
 * written into durable completion evidence.
 */
export function asciiTrimTaskChecklistCompletionEvidenceLabel(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a checklist completion-evidence label under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeTaskChecklistCompletionEvidenceLabel(
  value: string
): string | null {
  const trimmed = asciiTrimTaskChecklistCompletionEvidenceLabel(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize one operator checklist label before durable write.
 * Preserves soft empty → null (omit label; never invent English
 * `"Completed checklist item"`) while refusing to invent a clean label via
 * Unicode em-space / NBSP trim. Does not throw; Unicode-padded / unsafe /
 * non-string tokens return null so the write omits `label` without baking
 * UI locale or machine type into stored evidence, and without letting
 * non-nullish Unicode-only space or empty string bypass that omit through
 * the prior `??` cascade.
 */
export function normalizeTaskChecklistCompletionEvidenceLabel(
  value: string | null | undefined | unknown
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously bypassed the intentional omit / English hardcode via `??`.
  // Do not invent a clean durable label from padding.
  if (!value.trim()) return null;
  return canonicalizeTaskChecklistCompletionEvidenceLabel(value);
}

/**
 * Build one durable checklist completion-evidence row without English UI
 * fallbacks or machine-type promotion into `label`.
 */
export function buildChecklistCompletionEvidenceLabel(
  entry: { label?: unknown; type?: unknown }
): { type: "checklist_item"; label?: string; completed: true } {
  const label = normalizeTaskChecklistCompletionEvidenceLabel(entry.label);
  return {
    type: "checklist_item",
    ...(label ? { label } : {}),
    completed: true
  };
}
