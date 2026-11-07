/**
 * Insights How-Mise-knows memory evidenceNext presentation.nextStep
 * identity helpers (MISE-005ZM).
 *
 * Pins the Insights HowMiseKnows expanded evidenceNext Text that previously
 * always rendered raw `presentation.nextStep`:
 *   `<Text style={styles.evidenceNext}>{presentation.nextStep}</Text>`
 *
 * When a learning-memory summary has no presentation descriptor,
 * `presentLearningMemory` returns
 * `nextStep: \`${copy.evidenceLabel}: ${memory.nextStep}\`` as a raw
 * embedding of the free-text memory next step under a localized evidence
 * label. Empty / Unicode-only-space free-text next steps still produce a
 * non-nullish, truthy presentation next step (`"Evidence: \u2003"`), so
 * blank-looking next-step copy could appear inside the How Mise knows
 * expanded body with no intentional localized none marker. Separately,
 * Unicode `.trim()` on a padded free-text next step embedded into the
 * presentation string
 * (`"Evidence: \u2003Keep recording counts.\u2003".trim()`)
 * invents by stripping trailing Unicode padding before that string is
 * rendered into the evidenceNext Text
 * (`"Evidence: \u2003Keep recording counts."`).
 *
 * Single-line memory-next-step tips use ASCII end trim only and preserve
 * NBSP (no fold into plain space). Soft-null when Unicode trim would still
 * strip end padding (NBSP / em-space) so padding cannot invent equality with
 * an unpadded next step. Accents and case are preserved. Full C0/DEL
 * control rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **insights.memory.nextStep.none** nextStep tokens
 * only — the How Mise knows evidenceNext Text that falls through to that
 * fallback when soft-null. Not Insights How-Mise-knows memory subtitle
 * presentation.label (#1169), not How-Mise-knows presentation.operatorCopy
 * (#1170), not Insights signal presentation.label (#1167) / presentation.value
 * (#1168) / presentation.detail (#1166), not Task detail operational
 * presentation.title (#1160), and not Home HomeTaskRow presentation.title
 * (#1162). Soft empty / Unicode-padded / control-bearing tokens soft-null so
 * the live `|| t("insights.memory.nextStep.none")` branch owns the
 * intentional localized fallback. Ordinary ASCII whitespace still trims
 * clean.
 *
 * Complements open #1170 / #1169 / #1168 / #1167 / #1166 / #1160 / #1162
 * without sharing those modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Insights memory next step before it is
 * rendered into the How Mise knows evidenceNext Text.
 */
export function asciiTrimInsightsMemoryNextStep(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an Insights memory presentation.nextStep under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeInsightsMemoryNextStep(value: string): string | null {
  const trimmed = asciiTrimInsightsMemoryNextStep(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Insights How-Mise-knows `presentation.nextStep`.
 * Preserves soft empty → null (intentional localized
 * insights.memory.nextStep.none copy) while refusing to invent a clean memory
 * next step via Unicode em-space / NBSP trim. Does not throw;
 * Unicode-padded / unsafe / non-string tokens return null so the live
 * `|| t("insights.memory.nextStep.none")` branch owns the fallback without
 * inventing a clean Insights memory next step from padding, and without
 * letting non-nullish Unicode-only space or empty string render a
 * blank-looking evidenceNext body through the prior always-pass-nextStep
 * Text.
 */
export function normalizeInsightsMemoryNextStep(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered as the evidenceNext body instead of the
  // intentional localized insights.memory.nextStep.none copy.
  // Do not invent a clean Insights memory next step from padding.
  if (!value.trim()) return null;
  return canonicalizeInsightsMemoryNextStep(value);
}
