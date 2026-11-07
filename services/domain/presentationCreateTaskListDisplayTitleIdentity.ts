/**
 * Create Task list display task.title helpers (MISE-005YT).
 *
 * Pins Create Task list-row title presentation that previously always passed
 * raw `task.title` into the list display Text:
 * `<Text style={styles.taskTitle}>{task.title}</Text>`
 *
 * A Unicode-only-space task title (`"\u2003"`) is non-nullish and still
 * rendered as the entire title line, so blank-looking title copy appeared on
 * Create Task list cards with no intentional localized fallback. Empty string
 * has the same blank-body bypass. Separately, Unicode `.trim()` on a padded
 * title (`"\u2003Count walk-in\u2003".trim() === "Count walk-in"`) would invent
 * a clean display title if that gate Unicode-trimmed before rendering into the
 * Create Task list display Text.
 *
 * Single-line task-title tips use ASCII end trim only and preserve NBSP (no
 * fold into plain space). Soft-null when Unicode trim would still strip end
 * padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded task title. Accents and case are preserved. Full C0/DEL control
 * rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **operatorTasks.list.title.none** title tokens only —
 * the Create Task list display `task.title` that falls through to that
 * fallback when soft-null. Not Create Task list-row a11y task.title (#1072 /
 * MISE-005XL), not ChoiceRow dependency `label={task.title}`, not Create Task
 * form save-path title (#880 / MISE-005QT), not restaurant-tasks domain title
 * (#822), not Activity expand a11y event.title (#1071), and not Home
 * ApprovalsSection card.title (#1049). Soft empty / Unicode-padded /
 * control-bearing tokens soft-null so the live
 * `|| t("operatorTasks.list.title.none")` branch owns the intentional
 * localized fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1072 / #880 / #822 / #1071 / #1049 without sharing those
 * modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Create Task list display title before it is
 * rendered into the taskTitle Text.
 */
export function asciiTrimCreateTaskListDisplayTitle(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Create Task list display task.title under ASCII C. Returns
 * null when empty after ASCII trim, still Unicode-padded, or containing ASCII
 * controls.
 */
export function canonicalizeCreateTaskListDisplayTitle(value: string): string | null {
  const trimmed = asciiTrimCreateTaskListDisplayTitle(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Create Task list display `task.title`. Preserves soft
 * empty → null (intentional localized operatorTasks.list.title.none copy)
 * while refusing to invent a clean task title via Unicode em-space / NBSP
 * trim. Does not throw; Unicode-padded / unsafe / non-string tokens return
 * null so the live `|| t("operatorTasks.list.title.none")` branch owns the
 * fallback without inventing a clean Create Task list display title from
 * padding, and without letting non-nullish Unicode-only space or empty string
 * render a blank-looking title through the prior always-pass-title Text.
 */
export function normalizeCreateTaskListDisplayTitle(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered as the title Text instead of the intentional
  // localized operatorTasks.list.title.none copy.
  // Do not invent a clean Create Task list display title from padding.
  if (!value.trim()) return null;
  return canonicalizeCreateTaskListDisplayTitle(value);
}
