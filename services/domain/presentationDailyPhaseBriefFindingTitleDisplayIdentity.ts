/**
 * Daily Phase Brief FindingRow finding.title display helpers (MISE-005YX).
 *
 * Pins Daily Phase Brief FindingRow title presentation that previously always
 * passed raw `finding.title` into the findingTitle Text:
 * `<Text style={styles.findingTitle}>{finding.title}</Text>`
 *
 * A Unicode-only-space finding title (`"\u2003"`) is non-nullish and still
 * rendered as the entire findingTitle line, so blank-looking title copy
 * appeared on Daily Phase Brief finding rows with no intentional localized
 * fallback. Empty string has the same blank-body bypass. Separately, Unicode
 * `.trim()` on a padded title
 * (`"\u2003Verify produce count\u2003".trim() === "Verify produce count"`)
 * would invent a clean display title if that gate Unicode-trimmed before
 * rendering into the FindingRow findingTitle Text.
 *
 * Single-line finding-title tips use ASCII end trim only and preserve NBSP (no
 * fold into plain space). Soft-null when Unicode trim would still strip end
 * padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded finding title. Accents and case are preserved. Full C0/DEL control
 * rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **dailyPhaseBrief.findingTitle.none** title tokens
 * only — the Daily Phase Brief FindingRow display `finding.title` that falls
 * through to that fallback when soft-null. Not finding-row a11y finding.title
 * (#1076 / MISE-005XP), not finding.interpretation a11y chrome
 * (#1085 / MISE-005XY), not finding.interpretation display Text, not Daily
 * Brief Board finding.title display (#1145 / MISE-005YM), not Daily Brief
 * card header a11y finding.title (#1075 / MISE-005XO), not Daily Brief action
 * a11y finding.title (#1074 / MISE-005XN), and not compact-preview
 * firstFinding.title (#1146 / MISE-005YN). Soft empty / Unicode-padded /
 * control-bearing tokens soft-null so the live
 * `|| t("dailyPhaseBrief.findingTitle.none")` branch owns the intentional
 * localized fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1076 / #1085 / #1145 / #1075 / #1074 / #1146 without
 * sharing those modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Daily Phase Brief FindingRow display title
 * before it is rendered into the findingTitle Text.
 */
export function asciiTrimDailyPhaseBriefFindingTitleDisplay(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Daily Phase Brief FindingRow display finding.title under
 * ASCII C. Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeDailyPhaseBriefFindingTitleDisplay(
  value: string
): string | null {
  const trimmed = asciiTrimDailyPhaseBriefFindingTitleDisplay(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Daily Phase Brief FindingRow display `finding.title`.
 * Preserves soft empty → null (intentional localized findingTitle.none copy)
 * while refusing to invent a clean finding title via Unicode em-space / NBSP
 * trim. Does not throw; Unicode-padded / unsafe / non-string tokens return
 * null so the live `|| t("dailyPhaseBrief.findingTitle.none")` branch owns
 * the fallback without inventing a clean Phase Brief title from padding, and
 * without letting non-nullish Unicode-only space or empty string render a
 * blank-looking findingTitle through the prior always-pass-title row.
 */
export function normalizeDailyPhaseBriefFindingTitleDisplay(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered as the findingTitle Text instead of the
  // intentional localized findingTitle.none copy.
  // Do not invent a clean Daily Phase Brief FindingRow display title from
  // padding.
  if (!value.trim()) return null;
  return canonicalizeDailyPhaseBriefFindingTitleDisplay(value);
}
