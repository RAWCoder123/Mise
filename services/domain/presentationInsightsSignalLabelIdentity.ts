/**
 * Insights How-Mise-knows signal presentation.label identity helpers
 * (MISE-005ZI).
 *
 * Pins the Insights EvidenceRow label Text that previously always rendered
 * raw `presentation.label`:
 *   `<Text style={styles.signalLabel}>{presentation.label}</Text>`
 *
 * When a learning-memory signal has no presentation descriptor,
 * `presentLearningMemorySignal` returns `label: signal.label` as a raw
 * pass-through of the free-text signal label. Empty / Unicode-only-space
 * free-text labels still produce a non-nullish, truthy signal label
 * (`"\u2003"`), so blank-looking signal copy could appear on the Insights
 * How Mise knows evidence list with no intentional localized none marker.
 * Separately, Unicode `.trim()` on a padded free-text label
 * (`"\u2003Friday demand\u2003".trim()`) invents by stripping trailing
 * Unicode padding before that string is rendered into the signalLabel Text
 * (`"Friday demand"`).
 *
 * Single-line signal-label tips use ASCII end trim only and preserve NBSP
 * (no fold into plain space). Soft-null when Unicode trim would still strip
 * end padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded signal label. Accents and case are preserved. Full C0/DEL
 * control rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **insights.signal.label.none** label tokens only
 * — the Insights EvidenceRow signalLabel Text that falls through to that
 * fallback when soft-null. Not Insights signal presentation.detail (#1166),
 * not Insights signal presentation.value, not How-Mise-knows memory subtitle
 * `presentLearningMemory(...).label`, not Task detail operational
 * presentation.title (#1160), not Home HomeTaskRow presentation.title
 * (#1162), and not Create Task list display task.title (#1152). Soft empty /
 * Unicode-padded / control-bearing tokens soft-null so the live
 * `|| t("insights.signal.label.none")` branch owns the intentional localized
 * fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1166 / #1160 / #1162 / #1152 without sharing those
 * modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Insights signal label before it is
 * rendered into the signalLabel Text.
 */
export function asciiTrimInsightsSignalLabel(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an Insights signal presentation.label under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeInsightsSignalLabel(value: string): string | null {
  const trimmed = asciiTrimInsightsSignalLabel(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Insights How-Mise-knows `presentation.label`. Preserves
 * soft empty → null (intentional localized insights.signal.label.none copy)
 * while refusing to invent a clean signal label via Unicode em-space / NBSP
 * trim. Does not throw; Unicode-padded / unsafe / non-string tokens return
 * null so the live `|| t("insights.signal.label.none")` branch owns the
 * fallback without inventing a clean Insights signal label from padding, and
 * without letting non-nullish Unicode-only space or empty string render a
 * blank-looking signalLabel body through the prior always-pass-label Text.
 */
export function normalizeInsightsSignalLabel(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered as the signalLabel body instead of the
  // intentional localized insights.signal.label.none copy.
  // Do not invent a clean Insights signal label from padding.
  if (!value.trim()) return null;
  return canonicalizeInsightsSignalLabel(value);
}
