/**
 * Ask Mise answer-text topTaskTitles identity helpers (MISE-005ZF).
 *
 * Pins the Ask Mise briefing / general reply copy that previously interpolated
 * raw `presentOperationalTodayTask(...).title` into answer strings via
 * `topTaskTitles`:
 *   `t("ask.answer.briefing.focus", { tasks: topTaskTitles.join("; ") })`
 *   `t("ask.answer.general.tasks", { tasks: topTaskTitles.slice(0, 2).join("; ") ... })`
 *
 * Operator-authored restaurant-task titles and descriptor-less operational
 * Today titles flow through `presentOperationalTodayTask` into
 * `presentation.title` without soft-null. A Unicode-only-space task title
 * (`"\u2003"`) is non-nullish and truthy, so Ask Mise answer text could
 * interpolate blank-looking task identity with no intentional localized none
 * marker. Empty string has the same always-pass blank-looking path.
 * Separately, Unicode `.trim()` on a padded task title
 * (`"\u2003Count walk-in\u2003".trim() === "Count walk-in"`) would invent a
 * clean task identity if that gate Unicode-trimmed before joining into the
 * Ask Mise answer-text `{tasks}` interpolation.
 *
 * Single-line task-title tips use ASCII end trim only and preserve NBSP (no
 * fold into plain space). Soft-null when Unicode trim would still strip end
 * padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded task title. Accents and case are preserved. Full C0/DEL control
 * rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **ask.answer.taskTitle.none** title tokens only — the
 * Ask Mise answer-text `topTaskTitles` join that falls through to that fallback
 * when soft-null. Not Ask Mise priority-list display presentation.title
 * (#1163), not Home HomeTaskRow display presentation.title (#1162), not
 * Operating Plan Timeline display presentation.title (#1161), not Timeline
 * a11y presentation.title (#1077), not Task detail operational
 * presentation.title (#1160), not Task detail sharedTask.title (#1159), not
 * Home ActivityRow event.title (#1149), not Create Task list-row title
 * (#1152), and not `presentation.detail` display. Soft empty /
 * Unicode-padded / control-bearing tokens soft-null so the live
 * `|| t("ask.answer.taskTitle.none")` branch owns the intentional localized
 * fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1163 / #1162 / #1161 / #1160 / #1159 / #1149 / #1152 /
 * #1077 without sharing those modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Ask Mise answer-text task title before it is
 * interpolated into briefing / general reply copy.
 */
export function asciiTrimAskMiseAnswerTaskTitle(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an Ask Mise answer-text topTaskTitles title under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeAskMiseAnswerTaskTitle(value: string): string | null {
  const trimmed = asciiTrimAskMiseAnswerTaskTitle(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Ask Mise answer-text `topTaskTitles` entries.
 * Preserves soft empty → null (intentional localized ask.answer.taskTitle.none
 * copy) while refusing to invent a clean task title via Unicode em-space /
 * NBSP trim. Does not throw; Unicode-padded / unsafe / non-string tokens
 * return null so the live `|| t("ask.answer.taskTitle.none")` branch owns the
 * fallback without inventing a clean Ask Mise answer-text task title from
 * padding, and without letting non-nullish Unicode-only space or empty string
 * interpolate a blank-looking title through the prior always-pass path.
 */
export function normalizeAskMiseAnswerTaskTitle(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still interpolated into answer-text `{tasks}` instead of the
  // intentional localized ask.answer.taskTitle.none copy.
  // Do not invent a clean Ask Mise answer-text task title from padding.
  if (!value.trim()) return null;
  return canonicalizeAskMiseAnswerTaskTitle(value);
}
