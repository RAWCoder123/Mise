/**
 * Activity expand a11y event.title identity helpers (MISE-005XK).
 *
 * Pins the Activity hub expand-row accessibility interpolation that previously
 * always passed raw `event.title` into the title token:
 * `t("activity.expand.accessibility", { title: event.title })`
 *
 * A Unicode-only-space activity title (`"\u2003"`) is non-nullish and truthy, so
 * VoiceOver / TalkBack labels could include blank-looking activity identity with
 * no intentional localized none marker. Empty string has the same always-pass
 * blank-looking path. Separately, Unicode `.trim()` on a padded activity title
 * (`"\u2003Order approved\u2003".trim() === "Order approved"`) would invent a
 * clean activity identity if that gate Unicode-trimmed before interpolating into
 * the expand a11y chrome.
 *
 * Single-line activity-title tips use ASCII end trim only and preserve NBSP (no
 * fold into plain space). Soft-null when Unicode trim would still strip end
 * padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded activity title. Accents and case are preserved. Full C0/DEL control
 * rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **activity.expand.title.none** title tokens only —
 * the expand a11y `title` interpolation that falls through to that fallback
 * when soft-null. Not the Activity row display Text `{event.title}`, not
 * Activity subtitle restaurant.name (#1041), not Home activity titles, not
 * create-task list row a11y `task.title`, not Home ApprovalsSection card.title
 * (#1049), and not other tipped identity fields. Soft empty / Unicode-padded /
 * control-bearing tokens soft-null so the live
 * `|| t("activity.expand.title.none")` branch owns the intentional localized
 * fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1041 / #1049 without sharing those modules or rewriting
 * their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Activity expand a11y title before it is
 * interpolated into the accessibility label.
 */
export function asciiTrimActivityExpandTitle(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an Activity expand a11y event.title under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeActivityExpandTitle(value: string): string | null {
  const trimmed = asciiTrimActivityExpandTitle(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Activity expand a11y `event.title`. Preserves soft empty
 * → null (intentional localized expand.title.none copy) while refusing to
 * invent a clean activity title via Unicode em-space / NBSP trim. Does not
 * throw; Unicode-padded / unsafe / non-string tokens return null so the live
 * `|| t("activity.expand.title.none")` branch owns the fallback without
 * inventing a clean expand a11y title from padding, and without letting
 * non-nullish Unicode-only space or empty string interpolate a blank-looking
 * title through the prior always-pass path.
 */
export function normalizeActivityExpandTitle(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still interpolated into expand a11y instead of the intentional
  // localized expand.title.none copy.
  // Do not invent a clean Activity expand a11y title from padding.
  if (!value.trim()) return null;
  return canonicalizeActivityExpandTitle(value);
}
