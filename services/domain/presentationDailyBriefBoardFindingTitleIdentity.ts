/**
 * Daily Brief Board finding.title helpers (MISE-005YM).
 *
 * Pins Daily Brief Board finding-card title presentation that previously
 * always passed raw `finding.title` into the cardTitle Text:
 * `<Text style={styles.cardTitle}>{finding.title}</Text>`
 *
 * A Unicode-only-space finding title (`"\u2003"`) is non-nullish and still
 * rendered as the entire cardTitle line, so blank-looking title copy appeared
 * on Daily Brief finding cards with no intentional localized fallback. Empty
 * string has the same blank-body bypass. Separately, Unicode `.trim()` on a
 * padded title (`"\u2003Low stock risk\u2003".trim() === "Low stock risk"`)
 * would invent a clean display title if that gate Unicode-trimmed before
 * rendering into the Board cardTitle Text.
 *
 * Single-line finding-title tips use ASCII end trim only and preserve NBSP (no
 * fold into plain space). Soft-null when Unicode trim would still strip end
 * padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded finding title. Accents and case are preserved. Full C0/DEL control
 * rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **dailyBrief.findingTitle.none** title tokens only —
 * the Daily Brief Board `finding.title` that falls through to that fallback
 * when soft-null. Not card header a11y finding.title (#1075 / MISE-005XO), not
 * action a11y finding.title (#1074 / MISE-005XN), not Daily Phase Brief
 * finding-row a11y finding.title (#1076 / MISE-005XP), not operational-findings
 * domain title (#920 / MISE-005SH), not Board explanation display
 * (#1142 / MISE-005YJ), not Board recommendedAction display
 * (#1143 / MISE-005YK), not effectiveRecommendedAction annotation
 * (#1144 / MISE-005YL), not compact preview title chrome, and not
 * `app/more/daily-brief.tsx` finding title chrome. Soft empty /
 * Unicode-padded / control-bearing tokens soft-null so the live
 * `|| t("dailyBrief.findingTitle.none")` branch owns the intentional
 * localized fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1075 / #1074 / #1076 / #920 / #1142 / #1143 / #1144 without
 * sharing those modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Daily Brief Board finding title before it
 * is rendered into the cardTitle Text.
 */
export function asciiTrimDailyBriefBoardFindingTitle(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Daily Brief Board finding.title under ASCII C. Returns null
 * when empty after ASCII trim, still Unicode-padded, or containing ASCII
 * controls.
 */
export function canonicalizeDailyBriefBoardFindingTitle(value: string): string | null {
  const trimmed = asciiTrimDailyBriefBoardFindingTitle(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Daily Brief Board `finding.title` display. Preserves soft
 * empty → null (intentional localized findingTitle.none copy) while refusing
 * to invent a clean finding title via Unicode em-space / NBSP trim. Does not
 * throw; Unicode-padded / unsafe / non-string tokens return null so the live
 * `|| t("dailyBrief.findingTitle.none")` branch owns the fallback without
 * inventing a clean Board title from padding, and without letting non-nullish
 * Unicode-only space or empty string render a blank-looking cardTitle through
 * the prior always-pass-title row.
 */
export function normalizeDailyBriefBoardFindingTitle(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered as the cardTitle Text instead of the intentional
  // localized findingTitle.none copy.
  // Do not invent a clean Daily Brief Board finding title from padding.
  if (!value.trim()) return null;
  return canonicalizeDailyBriefBoardFindingTitle(value);
}
