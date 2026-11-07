/**
 * Home HomeTaskRow display presentation.title identity helpers (MISE-005ZD).
 *
 * Pins the Home Top-tasks HomeTaskRow title that previously always passed raw
 * `presentation.title` into OperationalRow:
 * `<OperationalRow title={presentation.title} … />`
 *
 * Operator-authored restaurant-task titles and descriptor-less operational
 * Today titles flow through `presentOperationalTodayTask` into
 * `presentation.title` without soft-null. A Unicode-only-space task title
 * (`"\u2003"`) is non-nullish and truthy, so Home Top-tasks rows could render
 * blank-looking task identity with no intentional localized none marker.
 * Empty string has the same always-pass blank-looking path. Separately,
 * Unicode `.trim()` on a padded task title
 * (`"\u2003Count walk-in\u2003".trim() === "Count walk-in"`) would invent a
 * clean task identity if that gate Unicode-trimmed before rendering into the
 * HomeTaskRow OperationalRow title.
 *
 * Single-line task-title tips use ASCII end trim only and preserve NBSP (no
 * fold into plain space). Soft-null when Unicode trim would still strip end
 * padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded task title. Accents and case are preserved. Full C0/DEL control
 * rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **home.tasks.row.title.none** title tokens only —
 * the Home HomeTaskRow display `presentation.title` that falls through to
 * that fallback when soft-null. Not Ask Mise priority presentation.title,
 * not Operating Plan Timeline display presentation.title (#1161), not
 * Timeline a11y presentation.title (#1077), not Task detail operational
 * presentation.title (#1160), not Task detail sharedTask.title (#1159), not
 * Home ActivityRow event.title (#1149), not Create Task list-row title
 * (#1152), and not `presentation.detail` display. Soft empty /
 * Unicode-padded / control-bearing tokens soft-null so the live
 * `|| t("home.tasks.row.title.none")` branch owns the intentional localized
 * fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1161 / #1160 / #1159 / #1149 / #1152 / #1077 without
 * sharing those modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Home HomeTaskRow display title before it is
 * rendered into the OperationalRow title.
 */
export function asciiTrimHomeTaskRowTitleDisplay(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Home HomeTaskRow display presentation.title under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeHomeTaskRowTitleDisplay(value: string): string | null {
  const trimmed = asciiTrimHomeTaskRowTitleDisplay(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Home HomeTaskRow display `presentation.title`. Preserves
 * soft empty → null (intentional localized home.tasks.row.title.none copy)
 * while refusing to invent a clean task title via Unicode em-space / NBSP
 * trim. Does not throw; Unicode-padded / unsafe / non-string tokens return
 * null so the live `|| t("home.tasks.row.title.none")` branch owns the
 * fallback without inventing a clean HomeTaskRow display title from padding,
 * and without letting non-nullish Unicode-only space or empty string render a
 * blank-looking title through the prior always-pass path.
 */
export function normalizeHomeTaskRowTitleDisplay(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered into the OperationalRow title instead of the
  // intentional localized home.tasks.row.title.none copy.
  // Do not invent a clean Home HomeTaskRow display title from padding.
  if (!value.trim()) return null;
  return canonicalizeHomeTaskRowTitleDisplay(value);
}
