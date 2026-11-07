/**
 * Activity row event.title helpers (MISE-005YP).
 *
 * Pins Activity hub row-title presentation that previously always passed raw
 * `event.title` into the title Text:
 * `<Text style={styles.title}>{event.title}</Text>`
 *
 * A Unicode-only-space activity title (`"\u2003"`) is non-nullish and still
 * rendered as the entire title line, so blank-looking title copy appeared on
 * Activity rows with no intentional localized fallback. Empty string has the
 * same blank-body bypass. Separately, Unicode `.trim()` on a padded title
 * (`"\u2003Order approved\u2003".trim() === "Order approved"`) would invent a
 * clean display title if that gate Unicode-trimmed before rendering into the
 * Activity row title Text.
 *
 * Single-line activity-title tips use ASCII end trim only and preserve NBSP
 * (no fold into plain space). Soft-null when Unicode trim would still strip
 * end padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded activity title. Accents and case are preserved. Full C0/DEL
 * control rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **activity.row.title.none** title tokens only — the
 * Activity row `event.title` that falls through to that fallback when
 * soft-null. Not Activity expand a11y event.title (#1071 / MISE-005XK), not
 * Activity subtitle restaurant.name (#1041), not Home ActivityRow
 * `event.title` display, not Activity `event.summary` display, not create-task
 * list-row a11y `task.title` (#1072), and not Home ApprovalsSection card.title
 * (#1049). Soft empty / Unicode-padded / control-bearing tokens soft-null so
 * the live `|| t("activity.row.title.none")` branch owns the intentional
 * localized fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1071 / #1041 / #1049 / #1072 without sharing those modules
 * or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Activity row title before it is rendered
 * into the title Text.
 */
export function asciiTrimActivityRowTitle(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an Activity row event.title under ASCII C. Returns null when
 * empty after ASCII trim, still Unicode-padded, or containing ASCII controls.
 */
export function canonicalizeActivityRowTitle(value: string): string | null {
  const trimmed = asciiTrimActivityRowTitle(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Activity row `event.title` display. Preserves soft empty
 * → null (intentional localized row.title.none copy) while refusing to invent
 * a clean activity title via Unicode em-space / NBSP trim. Does not throw;
 * Unicode-padded / unsafe / non-string tokens return null so the live
 * `|| t("activity.row.title.none")` branch owns the fallback without inventing
 * a clean Activity row title from padding, and without letting non-nullish
 * Unicode-only space or empty string render a blank-looking title through the
 * prior always-pass-title row.
 */
export function normalizeActivityRowTitle(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered as the title Text instead of the intentional
  // localized row.title.none copy.
  // Do not invent a clean Activity row title from padding.
  if (!value.trim()) return null;
  return canonicalizeActivityRowTitle(value);
}
