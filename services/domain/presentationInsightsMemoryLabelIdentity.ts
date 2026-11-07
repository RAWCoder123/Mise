/**
 * Insights How-Mise-knows memory subtitle presentation.label identity helpers
 * (MISE-005ZK).
 *
 * Pins the Insights HowMiseKnows subtitle that previously always interpolated
 * raw `presentation.label` into:
 *   `t("insights.memory.subtitle", { label: presentation.label, score: ... })`
 *
 * When a learning-memory summary has no presentation descriptor,
 * `presentLearningMemory` returns `label: memory.label` as a raw pass-through
 * of the free-text memory label. Empty / Unicode-only-space free-text values
 * still produce a non-nullish, truthy memory label (`"\u2003"`), so
 * blank-looking label copy could appear inside the How Mise knows subtitle
 * with no intentional localized none marker. Separately, Unicode `.trim()` on
 * a padded free-text label (`"\u2003Mise memory is reliable\u2003".trim()`)
 * invents by stripping trailing Unicode padding before that string is
 * interpolated into the subtitle (`"Mise memory is reliable"`).
 *
 * Single-line memory-label tips use ASCII end trim only and preserve NBSP
 * (no fold into plain space). Soft-null when Unicode trim would still strip
 * end padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded memory label. Accents and case are preserved. Full C0/DEL
 * control rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **insights.memory.label.none** value tokens only —
 * the How Mise knows subtitle `label` interpolation that falls through to
 * that fallback when soft-null. Not Insights signal presentation.label
 * (#1167), not Insights signal presentation.value (#1168), not Insights
 * signal presentation.detail (#1166), not Task detail operational
 * presentation.title (#1160), and not Home HomeTaskRow presentation.title
 * (#1162). Soft empty / Unicode-padded / control-bearing tokens soft-null so
 * the live `|| t("insights.memory.label.none")` branch owns the intentional
 * localized fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1168 / #1167 / #1166 / #1160 / #1162 without sharing those
 * modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Insights memory label before it is
 * interpolated into the How Mise knows subtitle.
 */
export function asciiTrimInsightsMemoryLabel(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an Insights memory presentation.label under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeInsightsMemoryLabel(value: string): string | null {
  const trimmed = asciiTrimInsightsMemoryLabel(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Insights How-Mise-knows `presentation.label`. Preserves
 * soft empty → null (intentional localized insights.memory.label.none copy)
 * while refusing to invent a clean memory label via Unicode em-space / NBSP
 * trim. Does not throw; Unicode-padded / unsafe / non-string tokens return
 * null so the live `|| t("insights.memory.label.none")` branch owns the
 * fallback without inventing a clean Insights memory label from padding, and
 * without letting non-nullish Unicode-only space or empty string render a
 * blank-looking subtitle label through the prior always-pass-label
 * interpolation.
 */
export function normalizeInsightsMemoryLabel(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still interpolated into the subtitle instead of the
  // intentional localized insights.memory.label.none copy.
  // Do not invent a clean Insights memory label from padding.
  if (!value.trim()) return null;
  return canonicalizeInsightsMemoryLabel(value);
}
