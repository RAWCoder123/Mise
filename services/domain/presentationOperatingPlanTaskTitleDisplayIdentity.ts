/**
 * Operating Plan Timeline display presentation.title identity helpers
 * (MISE-005ZC).
 *
 * Pins the Today OperatingPlanTimeline task-title Text that previously always
 * passed raw `presentation.title` into the visible row:
 * `<Text numberOfLines={2} style={styles.taskTitle}>{presentation.title}</Text>`
 *
 * Operator-authored restaurant-task titles and descriptor-less operational
 * Today titles flow through `presentOperatingPlanItem` /
 * `presentOperationalTodayTask` into `presentation.title` without soft-null.
 * A Unicode-only-space task title (`"\u2003"`) is non-nullish and truthy, so
 * the timeline could render blank-looking task identity with no intentional
 * localized none marker. Empty string has the same always-pass blank-looking
 * path. Separately, Unicode `.trim()` on a padded task title
 * (`"\u2003Count walk-in\u2003".trim() === "Count walk-in"`) would invent a
 * clean task identity if that gate Unicode-trimmed before rendering into the
 * timeline display Text.
 *
 * Single-line task-title tips use ASCII end trim only and preserve NBSP (no
 * fold into plain space). Soft-null when Unicode trim would still strip end
 * padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded task title. Accents and case are preserved. Full C0/DEL control
 * rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **today.task.title.none** title tokens only — the
 * OperatingPlanTimeline display `presentation.title` that falls through to
 * that fallback when soft-null. Not the timeline a11y
 * `today.task.accessibility` title interpolation (#1077 / MISE-005XQ), not
 * `presentation.detail` display or a11y chrome (#1078), not
 * `actionLabel` a11y chrome, not Create Task list-row a11y title (#1072), not
 * Activity expand a11y title (#1071), not Daily Phase Brief finding-row a11y
 * title (#1076), not Home ApprovalsSection card.title (#1049), not Task detail
 * operational presentation.title (#1160), and not Home / Ask Mise
 * presentation.title surfaces. Soft empty / Unicode-padded / control-bearing
 * tokens soft-null so the live `|| t("today.task.title.none")` branch owns
 * the intentional localized fallback. Ordinary ASCII whitespace still trims
 * clean.
 *
 * Complements open #1077 / #1078 / #1160 / #1072 / #1071 / #1076 / #1049
 * without sharing those modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Operating Plan Timeline display title
 * before it is rendered into the task-title Text.
 */
export function asciiTrimOperatingPlanTaskTitleDisplay(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an Operating Plan Timeline display presentation.title under
 * ASCII C. Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeOperatingPlanTaskTitleDisplay(value: string): string | null {
  const trimmed = asciiTrimOperatingPlanTaskTitleDisplay(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Operating Plan Timeline display `presentation.title`.
 * Preserves soft empty → null (intentional localized today.task.title.none
 * copy) while refusing to invent a clean task title via Unicode em-space /
 * NBSP trim. Does not throw; Unicode-padded / unsafe / non-string tokens
 * return null so the live `|| t("today.task.title.none")` branch owns the
 * fallback without inventing a clean timeline display title from padding,
 * and without letting non-nullish Unicode-only space or empty string render
 * a blank-looking title through the prior always-pass path.
 */
export function normalizeOperatingPlanTaskTitleDisplay(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered into the task-title Text instead of the
  // intentional localized today.task.title.none copy.
  // Do not invent a clean Operating Plan Timeline display title from padding.
  if (!value.trim()) return null;
  return canonicalizeOperatingPlanTaskTitleDisplay(value);
}
