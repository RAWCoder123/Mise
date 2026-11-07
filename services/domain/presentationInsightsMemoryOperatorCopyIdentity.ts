/**
 * Insights How-Mise-knows memory evidenceIntro presentation.operatorCopy
 * identity helpers (MISE-005ZL).
 *
 * Pins the Insights HowMiseKnows expanded evidenceIntro Text that previously
 * always rendered raw `presentation.operatorCopy`:
 *   `<Text style={styles.evidenceIntro}>{presentation.operatorCopy}</Text>`
 *
 * When a learning-memory summary has no presentation descriptor,
 * `presentLearningMemory` returns `operatorCopy: memory.operatorCopy` as a
 * raw pass-through of the free-text memory operator copy. Empty /
 * Unicode-only-space free-text values still produce a non-nullish, truthy
 * operator copy (`"\u2003"`), so blank-looking intro copy could appear inside
 * the How Mise knows expanded body with no intentional localized none marker.
 * Separately, Unicode `.trim()` on a padded free-text operator copy
 * (`"\u2003Recipe baselines give Mise enough evidence.\u2003".trim()`)
 * invents by stripping trailing Unicode padding before that string is
 * rendered into the evidenceIntro Text
 * (`"Recipe baselines give Mise enough evidence."`).
 *
 * Single-line memory-operator-copy tips use ASCII end trim only and preserve
 * NBSP (no fold into plain space). Soft-null when Unicode trim would still
 * strip end padding (NBSP / em-space) so padding cannot invent equality with
 * an unpadded operator copy. Accents and case are preserved. Full C0/DEL
 * control rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **insights.memory.copy.none** operatorCopy tokens
 * only — the How Mise knows evidenceIntro Text that falls through to that
 * fallback when soft-null. Not Insights How-Mise-knows memory subtitle
 * presentation.label (#1169), not How-Mise-knows presentation.nextStep, not
 * Insights signal presentation.label (#1167) / presentation.value (#1168) /
 * presentation.detail (#1166), not Task detail operational presentation.title
 * (#1160), and not Home HomeTaskRow presentation.title (#1162). Soft empty /
 * Unicode-padded / control-bearing tokens soft-null so the live
 * `|| t("insights.memory.copy.none")` branch owns the intentional localized
 * fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1169 / #1168 / #1167 / #1166 / #1160 / #1162 without
 * sharing those modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Insights memory operator copy before it is
 * rendered into the How Mise knows evidenceIntro Text.
 */
export function asciiTrimInsightsMemoryOperatorCopy(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an Insights memory presentation.operatorCopy under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeInsightsMemoryOperatorCopy(value: string): string | null {
  const trimmed = asciiTrimInsightsMemoryOperatorCopy(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Insights How-Mise-knows `presentation.operatorCopy`.
 * Preserves soft empty → null (intentional localized
 * insights.memory.copy.none copy) while refusing to invent a clean memory
 * operator copy via Unicode em-space / NBSP trim. Does not throw;
 * Unicode-padded / unsafe / non-string tokens return null so the live
 * `|| t("insights.memory.copy.none")` branch owns the fallback without
 * inventing a clean Insights memory operator copy from padding, and without
 * letting non-nullish Unicode-only space or empty string render a
 * blank-looking evidenceIntro body through the prior always-pass-operatorCopy
 * Text.
 */
export function normalizeInsightsMemoryOperatorCopy(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered as the evidenceIntro body instead of the
  // intentional localized insights.memory.copy.none copy.
  // Do not invent a clean Insights memory operator copy from padding.
  if (!value.trim()) return null;
  return canonicalizeInsightsMemoryOperatorCopy(value);
}
