/**
 * Create Task list row a11y task.title identity helpers (MISE-005XL).
 *
 * Pins the Create Task list-row accessibility interpolation that previously
 * always passed raw `task.title` into the title token:
 * `t("operatorTasks.list.rowAccessibility", { title: task.title })`
 *
 * A Unicode-only-space task title (`"\u2003"`) is non-nullish and truthy, so
 * VoiceOver / TalkBack labels could include blank-looking task identity with
 * no intentional localized none marker. Empty string has the same always-pass
 * blank-looking path. Separately, Unicode `.trim()` on a padded task title
 * (`"\u2003Count walk-in\u2003".trim() === "Count walk-in"`) would invent a
 * clean task identity if that gate Unicode-trimmed before interpolating into
 * the list-row a11y chrome.
 *
 * Single-line task-title tips use ASCII end trim only and preserve NBSP (no
 * fold into plain space). Soft-null when Unicode trim would still strip end
 * padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded task title. Accents and case are preserved. Full C0/DEL control
 * rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **operatorTasks.list.rowTitle.none** title tokens
 * only — the list-row a11y `title` interpolation that falls through to that
 * fallback when soft-null. Not the Create Task list display Text
 * `{task.title}`, not ChoiceRow dependency `label={task.title}`, not Create
 * Task form save-path title (#880 / MISE-005QT), not restaurant-tasks domain
 * title (#822), not floor-notes titles (#838), not Activity expand a11y
 * event.title (#1071), and not Home ApprovalsSection card.title (#1049). Soft
 * empty / Unicode-padded / control-bearing tokens soft-null so the live
 * `|| t("operatorTasks.list.rowTitle.none")` branch owns the intentional
 * localized fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #880 / #1071 / #1049 without sharing those modules or
 * rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Create Task list-row a11y title before it is
 * interpolated into the accessibility label.
 */
export function asciiTrimCreateTaskListRowTitle(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Create Task list-row a11y task.title under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeCreateTaskListRowTitle(value: string): string | null {
  const trimmed = asciiTrimCreateTaskListRowTitle(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Create Task list-row a11y `task.title`. Preserves soft
 * empty → null (intentional localized list.rowTitle.none copy) while refusing
 * to invent a clean task title via Unicode em-space / NBSP trim. Does not
 * throw; Unicode-padded / unsafe / non-string tokens return null so the live
 * `|| t("operatorTasks.list.rowTitle.none")` branch owns the fallback without
 * inventing a clean list-row a11y title from padding, and without letting
 * non-nullish Unicode-only space or empty string interpolate a blank-looking
 * title through the prior always-pass path.
 */
export function normalizeCreateTaskListRowTitle(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still interpolated into list-row a11y instead of the intentional
  // localized list.rowTitle.none copy.
  // Do not invent a clean Create Task list-row a11y title from padding.
  if (!value.trim()) return null;
  return canonicalizeCreateTaskListRowTitle(value);
}
