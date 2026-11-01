/**
 * Shared-task checklist `tasks.shared.checklistItem` display helpers
 * (MISE-005VR).
 *
 * Pins the Task detail checklist row that previously selected display text
 * with nullish coalescing before the intentional localized fallback:
 * `entry.label ?? entry.type ?? t("tasks.shared.checklistItem", { number })`.
 *
 * A Unicode-only-space label (`"\u2003"`) is non-nullish
 * (`("\u2003" ?? FALLBACK) === "\u2003"`), so the intentional
 * `tasks.shared.checklistItem` copy was bypassed (and the type candidate was
 * never consulted). Empty string has the same `??` bypass
 * (`("" ?? FALLBACK) === ""`). The same bypass applies when `label` is absent
 * and `type` alone is Unicode-only space or empty. Separately, Unicode
 * `.trim()` on padded checklist labels
 * (`"\u2003Walk-in count\u2003".trim() === "Walk-in count"`) would invent a
 * clean display label if that gate Unicode-trimmed before rendering into the
 * checklist row.
 *
 * Single-line checklist label/type tips use ASCII end trim only and preserve
 * NBSP (no fold into plain space). Soft-null when Unicode trim would still
 * strip end padding (NBSP / em-space) so padding cannot invent equality with
 * an unpadded checklist label. Accents and case are preserved. Full C0/DEL
 * control rejection applies (no LF/TAB/CR allowlist); multiline free-text
 * detail / evidence note display stays on open #1025 / #883 / evidence
 * `??` presentation (next tip).
 *
 * These are presentation **tasks.shared.checklistItem** checklist label/type
 * display tokens only — not Task detail instructions →
 * `tasks.shared.noInstructions` (#1025), not domain create/hydrate detail
 * (#823), not completion evidence notes (#883), not evidence display
 * `entry.note ?? entry.label ?? entry.type ?? tasks.shared.evidence`, not
 * `completionResult` (#824), not Create Task UI body/detail pass-through,
 * and not the completion write-path English `"Completed checklist item"`
 * hardcode. Soft empty / Unicode-padded / control-bearing tokens soft-null
 * so the live `|| t("tasks.shared.checklistItem", …)` branch owns the
 * intentional localized fallback. Ordinary ASCII whitespace still trims
 * clean.
 *
 * Complements open #1025 / #1024 / #823 / #883 / #824 on related free-text /
 * name paths without sharing those modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized checklist label before it is rendered into
 * the Task detail checklist row.
 */
export function asciiTrimTasksSharedChecklistItem(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Task detail checklist label/type under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeTasksSharedChecklistItem(
  value: string
): string | null {
  const trimmed = asciiTrimTasksSharedChecklistItem(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize one Task detail checklist label or type candidate.
 * Preserves soft empty → null (intentional localized
 * tasks.shared.checklistItem copy) while refusing to invent a clean checklist
 * label via Unicode em-space / NBSP trim. Does not throw; Unicode-padded /
 * unsafe / non-string tokens return null so the live
 * `|| t("tasks.shared.checklistItem", …)` branch owns the fallback without
 * inventing a clean checklist identity from padding, and without letting
 * non-nullish Unicode-only space or empty string bypass that fallback through
 * the prior `??` cascade.
 */
export function normalizeTasksSharedChecklistItem(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously bypassed the intentional localized tasks.shared.checklistItem
  // copy via `??`. Do not invent a clean checklist label from padding.
  if (!value.trim()) return null;
  return canonicalizeTasksSharedChecklistItem(value);
}
