/**
 * Ask Mise priority-list display presentation.title identity helpers
 * (MISE-005ZE).
 *
 * Pins the Ask Mise priority-card title Text that previously always passed raw
 * `presentation.title` into the visible row:
 * `<Text numberOfLines={1} style={styles.priorityTitle}>{presentation.title}</Text>`
 *
 * Operator-authored restaurant-task titles and descriptor-less operational
 * Today titles flow through `presentOperationalTodayTask` into
 * `presentation.title` without soft-null. A Unicode-only-space task title
 * (`"\u2003"`) is non-nullish and truthy, so Ask Mise priority cards could
 * render blank-looking task identity with no intentional localized none
 * marker. Empty string has the same always-pass blank-looking path.
 * Separately, Unicode `.trim()` on a padded task title
 * (`"\u2003Count walk-in\u2003".trim() === "Count walk-in"`) would invent a
 * clean task identity if that gate Unicode-trimmed before rendering into the
 * Ask Mise priority title Text.
 *
 * Single-line task-title tips use ASCII end trim only and preserve NBSP (no
 * fold into plain space). Soft-null when Unicode trim would still strip end
 * padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded task title. Accents and case are preserved. Full C0/DEL control
 * rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **ask.priority.title.none** title tokens only — the
 * Ask Mise priority-list display `presentation.title` that falls through to
 * that fallback when soft-null. Not Home HomeTaskRow display
 * presentation.title (#1162), not Operating Plan Timeline display
 * presentation.title (#1161), not Timeline a11y presentation.title (#1077),
 * not Task detail operational presentation.title (#1160), not Task detail
 * sharedTask.title (#1159), not Home ActivityRow event.title (#1149), not
 * Create Task list-row title (#1152), not `presentation.detail` display, and
 * not `services/ai/askMise.ts` answer-text `topTaskTitles` interpolation
 * (separate tip). Soft empty / Unicode-padded / control-bearing tokens
 * soft-null so the live `|| t("ask.priority.title.none")` branch owns the
 * intentional localized fallback. Ordinary ASCII whitespace still trims
 * clean.
 *
 * Complements open #1162 / #1161 / #1160 / #1159 / #1149 / #1152 / #1077
 * without sharing those modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Ask Mise priority display title before it is
 * rendered into the priority title Text.
 */
export function asciiTrimAskMisePriorityTitle(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an Ask Mise priority-list display presentation.title under
 * ASCII C. Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeAskMisePriorityTitle(value: string): string | null {
  const trimmed = asciiTrimAskMisePriorityTitle(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Ask Mise priority-list display `presentation.title`.
 * Preserves soft empty → null (intentional localized ask.priority.title.none
 * copy) while refusing to invent a clean task title via Unicode em-space /
 * NBSP trim. Does not throw; Unicode-padded / unsafe / non-string tokens
 * return null so the live `|| t("ask.priority.title.none")` branch owns the
 * fallback without inventing a clean Ask Mise priority display title from
 * padding, and without letting non-nullish Unicode-only space or empty string
 * render a blank-looking title through the prior always-pass path.
 */
export function normalizeAskMisePriorityTitle(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered into the priority title Text instead of the
  // intentional localized ask.priority.title.none copy.
  // Do not invent a clean Ask Mise priority display title from padding.
  if (!value.trim()) return null;
  return canonicalizeAskMisePriorityTitle(value);
}
