/**
 * Insights How-Mise-knows signal presentation.value identity helpers
 * (MISE-005ZJ).
 *
 * Pins the Insights EvidenceRow value Text that previously always rendered
 * raw `presentation.value`:
 *   `<Text style={styles.signalValue}>{presentation.value}</Text>`
 *
 * When a learning-memory signal has no presentation descriptor,
 * `presentLearningMemorySignal` returns `value: signal.value` as a raw
 * pass-through of the free-text signal value. Empty / Unicode-only-space
 * free-text values still produce a non-nullish, truthy signal value
 * (`"\u2003"`), so blank-looking signal copy could appear on the Insights
 * How Mise knows evidence list with no intentional localized none marker.
 * Separately, Unicode `.trim()` on a padded free-text value
 * (`"\u2003+18%\u2003".trim()`) invents by stripping trailing Unicode
 * padding before that string is rendered into the signalValue Text
 * (`"+18%"`).
 *
 * Single-line signal-value tips use ASCII end trim only and preserve NBSP
 * (no fold into plain space). Soft-null when Unicode trim would still strip
 * end padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded signal value. Accents and case are preserved. Full C0/DEL
 * control rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **insights.signal.value.none** value tokens only
 * — the Insights EvidenceRow signalValue Text that falls through to that
 * fallback when soft-null. Not Insights signal presentation.label (#1167),
 * not Insights signal presentation.detail (#1166), not How-Mise-knows memory
 * subtitle `presentLearningMemory(...).label`, not Task detail operational
 * presentation.title (#1160), and not Home HomeTaskRow presentation.title
 * (#1162). Soft empty / Unicode-padded / control-bearing tokens soft-null so
 * the live `|| t("insights.signal.value.none")` branch owns the intentional
 * localized fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1167 / #1166 / #1160 / #1162 without sharing those
 * modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Insights signal value before it is
 * rendered into the signalValue Text.
 */
export function asciiTrimInsightsSignalValue(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an Insights signal presentation.value under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeInsightsSignalValue(value: string): string | null {
  const trimmed = asciiTrimInsightsSignalValue(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Insights How-Mise-knows `presentation.value`. Preserves
 * soft empty → null (intentional localized insights.signal.value.none copy)
 * while refusing to invent a clean signal value via Unicode em-space / NBSP
 * trim. Does not throw; Unicode-padded / unsafe / non-string tokens return
 * null so the live `|| t("insights.signal.value.none")` branch owns the
 * fallback without inventing a clean Insights signal value from padding, and
 * without letting non-nullish Unicode-only space or empty string render a
 * blank-looking signalValue body through the prior always-pass-value Text.
 */
export function normalizeInsightsSignalValue(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered as the signalValue body instead of the
  // intentional localized insights.signal.value.none copy.
  // Do not invent a clean Insights signal value from padding.
  if (!value.trim()) return null;
  return canonicalizeInsightsSignalValue(value);
}
