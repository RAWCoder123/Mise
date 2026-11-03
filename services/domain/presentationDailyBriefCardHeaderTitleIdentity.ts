/**
 * Daily Brief card header a11y finding.title identity helpers (MISE-005XO).
 *
 * Pins the Daily Brief finding card header accessibility interpolation that
 * previously always passed raw `finding.title` into the template:
 * `accessibilityLabel={`${finding.title}. ${severityLabel}`}`
 *
 * A Unicode-only-space finding title (`"\u2003"`) is non-nullish and truthy, so
 * VoiceOver / TalkBack labels could include blank-looking finding identity with
 * no intentional localized none marker. Empty string has the same always-pass
 * blank-looking path. Separately, Unicode `.trim()` on a padded finding title
 * (`"\u2003Low stock risk\u2003".trim() === "Low stock risk"`) would invent a
 * clean finding identity if that gate Unicode-trimmed before interpolating into
 * the card header a11y chrome.
 *
 * Single-line finding-title tips use ASCII end trim only and preserve NBSP (no
 * fold into plain space). Soft-null when Unicode trim would still strip end
 * padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded finding title. Accents and case are preserved. Full C0/DEL control
 * rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **dailyBrief.cardHeader.title.none** title tokens only —
 * the Daily Brief card header a11y `finding.title` template interpolation that
 * falls through to that fallback when soft-null. Not the Daily Brief card
 * display Text `{finding.title}`, not the approve / edit / dismiss action a11y
 * title tokens (#1074), not `app/more/daily-brief.tsx` finding title chrome,
 * not Daily Brief recommended-action edits (#884), not Activity expand a11y
 * event.title (#1071), not Create Task list-row a11y title (#1072), and not
 * Home ApprovalsSection card.title (#1049). Soft empty / Unicode-padded /
 * control-bearing tokens soft-null so the live
 * `|| t("dailyBrief.cardHeader.title.none")` branch owns the intentional
 * localized fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1074 / #884 / #1071 / #1072 / #1049 without sharing those
 * modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Daily Brief card header a11y title before it
 * is interpolated into the accessibility label.
 */
export function asciiTrimDailyBriefCardHeaderTitle(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Daily Brief card header a11y finding.title under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeDailyBriefCardHeaderTitle(value: string): string | null {
  const trimmed = asciiTrimDailyBriefCardHeaderTitle(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Daily Brief card header a11y `finding.title`. Preserves
 * soft empty → null (intentional localized cardHeader.title.none copy) while
 * refusing to invent a clean finding title via Unicode em-space / NBSP trim.
 * Does not throw; Unicode-padded / unsafe / non-string tokens return null so
 * the live `|| t("dailyBrief.cardHeader.title.none")` branch owns the fallback
 * without inventing a clean card header a11y title from padding, and without
 * letting non-nullish Unicode-only space or empty string interpolate a
 * blank-looking title through the prior always-pass path.
 */
export function normalizeDailyBriefCardHeaderTitle(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still interpolated into card header a11y instead of the
  // intentional localized cardHeader.title.none copy.
  // Do not invent a clean Daily Brief card header a11y title from padding.
  if (!value.trim()) return null;
  return canonicalizeDailyBriefCardHeaderTitle(value);
}
