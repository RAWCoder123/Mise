/**
 * Task detail operational presentation.title helpers (MISE-005ZB).
 *
 * Pins Task detail hero presentation that previously always passed raw
 * `presentation.title` into the title Text:
 * `<Text style={styles.title}>{presentation.title}</Text>`
 *
 * When an operational Today task has no presentation descriptor,
 * `presentOperationalTodayTask` returns `title: task.title` as a raw
 * pass-through. A Unicode-only-space task title (`"\u2003"`) is non-nullish
 * and still rendered as the entire hero title line, so blank-looking task
 * identity appeared on Task detail with no intentional localized fallback.
 * Empty string has the same blank-body bypass. Separately, Unicode `.trim()`
 * on a padded title (`"\u2003Count walk-in\u2003".trim() === "Count walk-in"`)
 * would invent a clean display title if that gate Unicode-trimmed before
 * rendering into the Task detail operational hero title Text.
 *
 * Single-line task-title tips use ASCII end trim only and preserve NBSP (no
 * fold into plain space). Soft-null when Unicode trim would still strip end
 * padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded task title. Accents and case are preserved. Full C0/DEL control
 * rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **tasks.operational.title.none** title tokens only —
 * the Task detail operational hero `presentation.title` that falls through to
 * that fallback when soft-null. Not Task detail sharedTask.title (#1159 /
 * MISE-005ZA), not Create Task list display task.title (#1152 / MISE-005YT),
 * not Create Task dependency ChoiceRow task.title (#1153 / MISE-005YU), not
 * Create Task list-row a11y task.title (#1072 / MISE-005XL), not Create Task
 * form save-path title (#880 / MISE-005QT), not restaurant-tasks domain title
 * (#822 / MISE-005ON), not Operating Plan Timeline a11y presentation.title
 * (#1077 / MISE-005XQ), not Home / Ask Mise presentation.title surfaces, and
 * not `presentation.detail`. Soft empty / Unicode-padded / control-bearing
 * tokens soft-null so the live `|| t("tasks.operational.title.none")` branch
 * owns the intentional localized fallback. Ordinary ASCII whitespace still
 * trims clean.
 *
 * Complements open #1159 / #1152 / #1153 / #1077 / #1072 / #880 / #822 without
 * sharing those modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Task detail operational title before it is
 * rendered into the hero title Text.
 */
export function asciiTrimTaskDetailOperationalTitle(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Task detail operational presentation.title under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeTaskDetailOperationalTitle(value: string): string | null {
  const trimmed = asciiTrimTaskDetailOperationalTitle(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Task detail operational `presentation.title`. Preserves
 * soft empty → null (intentional localized tasks.operational.title.none copy)
 * while refusing to invent a clean task title via Unicode em-space / NBSP trim.
 * Does not throw; Unicode-padded / unsafe / non-string tokens return null so
 * the live `|| t("tasks.operational.title.none")` branch owns the fallback
 * without inventing a clean Task detail operational title from padding, and
 * without letting non-nullish Unicode-only space or empty string render a
 * blank-looking title through the prior always-pass-title Text.
 */
export function normalizeTaskDetailOperationalTitle(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered as the title Text instead of the intentional
  // localized tasks.operational.title.none copy.
  // Do not invent a clean Task detail operational title from padding.
  if (!value.trim()) return null;
  return canonicalizeTaskDetailOperationalTitle(value);
}
