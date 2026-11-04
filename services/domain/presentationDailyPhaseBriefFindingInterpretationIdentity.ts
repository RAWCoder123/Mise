/**
 * Daily Phase Brief finding-row a11y finding.interpretation identity helpers
 * (MISE-005XY).
 *
 * Pins the Daily Phase Brief FindingRow accessibility interpolation that
 * previously always passed raw `finding.interpretation` into the template:
 * `accessibilityLabel={`${finding.title}. ${finding.interpretation}`}`
 *
 * A Unicode-only-space finding interpretation (`"\u2003"`) is non-nullish and
 * truthy, so VoiceOver / TalkBack labels could include blank-looking finding
 * detail with no intentional localized none marker. Empty string has the same
 * always-pass blank-looking path. Separately, Unicode `.trim()` on a padded
 * finding interpretation
 * (`"\u2003Low stock before lunch\u2003".trim() === "Low stock before lunch"`)
 * would invent a clean finding detail if that gate Unicode-trimmed before
 * interpolating into the finding-row a11y chrome.
 *
 * Single-line finding-interpretation tips use ASCII end trim only and preserve
 * NBSP (no fold into plain space). Soft-null when Unicode trim would still
 * strip end padding (NBSP / em-space) so padding cannot invent equality with
 * an unpadded finding interpretation. Accents and case are preserved. Full
 * C0/DEL control rejection applies (no LF/TAB/CR allowlist) because this token
 * is interpolated into a single-line accessibility label.
 *
 * These are presentation **dailyPhaseBrief.finding.interpretation.none**
 * interpretation tokens only — the Daily Phase Brief finding-row a11y
 * `finding.interpretation` template interpolation that falls through to that
 * fallback when soft-null. Not the finding-row display Text
 * `{finding.interpretation}`, not finding.title a11y chrome (#1076), not Daily
 * Brief card header a11y title (#1075), not Daily Brief action a11y title
 * (#1074), not Operating Plan Timeline a11y detail (#1078), not Activity expand
 * a11y title (#1071), and not Create Task list-row a11y title (#1072). Soft
 * empty / Unicode-padded / control-bearing tokens soft-null so the live
 * `|| t("dailyPhaseBrief.finding.interpretation.none")` branch owns the
 * intentional localized fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1076 / #1075 / #1074 / #1078 / #1071 / #1072 without sharing
 * those modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Daily Phase Brief finding-row a11y
 * interpretation before it is interpolated into the accessibility label.
 */
export function asciiTrimDailyPhaseBriefFindingInterpretation(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Daily Phase Brief finding-row a11y finding.interpretation
 * under ASCII C. Returns null when empty after ASCII trim, still
 * Unicode-padded, or containing ASCII controls.
 */
export function canonicalizeDailyPhaseBriefFindingInterpretation(
  value: string
): string | null {
  const trimmed = asciiTrimDailyPhaseBriefFindingInterpretation(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Daily Phase Brief finding-row a11y
 * `finding.interpretation`. Preserves soft empty → null (intentional localized
 * finding.interpretation.none copy) while refusing to invent a clean finding
 * interpretation via Unicode em-space / NBSP trim. Does not throw;
 * Unicode-padded / unsafe / non-string tokens return null so the live
 * `|| t("dailyPhaseBrief.finding.interpretation.none")` branch owns the
 * fallback without inventing a clean finding-row a11y interpretation from
 * padding, and without letting non-nullish Unicode-only space or empty string
 * interpolate a blank-looking interpretation through the prior always-pass
 * path.
 */
export function normalizeDailyPhaseBriefFindingInterpretation(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still interpolated into finding-row a11y instead of the
  // intentional localized finding.interpretation.none copy.
  // Do not invent a clean Daily Phase Brief finding-row a11y interpretation
  // from padding.
  if (!value.trim()) return null;
  return canonicalizeDailyPhaseBriefFindingInterpretation(value);
}
