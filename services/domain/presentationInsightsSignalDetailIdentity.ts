/**
 * Insights How-Mise-knows signal presentation.detail identity helpers
 * (MISE-005ZH).
 *
 * Pins the Insights EvidenceRow detail Text that previously always rendered
 * raw `presentation.detail`:
 *   `<Text style={styles.signalDetail}>{presentation.detail}</Text>`
 *
 * When a learning-memory signal has no presentation descriptor,
 * `presentLearningMemorySignal` returns
 * `detail: \`${evidenceLabel}: ${signal.detail}\`` as an evidence-prefixed
 * pass-through of the free-text signal detail. Empty / Unicode-only-space
 * free-text details still produce a non-nullish, truthy signal detail
 * (`"Evidence: \u2003"`), so blank-looking signal copy could appear on the
 * Insights How Mise knows evidence list with no intentional localized none
 * marker. Separately, Unicode `.trim()` on a padded composed detail
 * (`"Evidence: \u2003Friday dinner demand is typically higher.\u2003".trim()`)
 * invents by stripping trailing Unicode padding before that string is
 * rendered into the signalDetail Text. The free-text portion alone also
 * invents fully
 * (`"\u2003Friday dinner demand is typically higher.\u2003".trim() ===
 * "Friday dinner demand is typically higher."`).
 *
 * Single-line signal-detail tips use ASCII end trim only and preserve NBSP
 * (no fold into plain space). Soft-null when Unicode trim would still strip
 * end padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded signal detail. Accents and case are preserved. Full C0/DEL
 * control rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **insights.signal.detail.none** detail tokens only
 * — the Insights EvidenceRow signalDetail Text that falls through to that
 * fallback when soft-null. Not Task detail operational presentation.detail
 * (#1165), not Operating Plan Timeline a11y presentation.detail (#1078), not
 * Task detail operational presentation.title (#1160), not Restaurant Memory
 * evidence entry.summary (#1154), not Insights signal presentation.label /
 * presentation.value, and not Daily Brief Board finding.explanation (#1142).
 * Soft empty / Unicode-padded / control-bearing tokens soft-null so the live
 * `|| t("insights.signal.detail.none")` branch owns the intentional localized
 * fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1165 / #1078 / #1160 / #1154 / #1142 without sharing those
 * modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Insights signal detail before it is
 * rendered into the signalDetail Text.
 */
export function asciiTrimInsightsSignalDetail(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an Insights signal presentation.detail under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeInsightsSignalDetail(value: string): string | null {
  const trimmed = asciiTrimInsightsSignalDetail(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Insights How-Mise-knows `presentation.detail`. Preserves
 * soft empty → null (intentional localized insights.signal.detail.none copy)
 * while refusing to invent a clean signal detail via Unicode em-space / NBSP
 * trim. Does not throw; Unicode-padded / unsafe / non-string tokens return
 * null so the live `|| t("insights.signal.detail.none")` branch owns the
 * fallback without inventing a clean Insights signal detail from padding, and
 * without letting non-nullish Unicode-only space or empty string render a
 * blank-looking signalDetail body through the prior always-pass-detail Text.
 */
export function normalizeInsightsSignalDetail(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered as the signalDetail body instead of the
  // intentional localized insights.signal.detail.none copy.
  // Do not invent a clean Insights signal detail from padding.
  if (!value.trim()) return null;
  return canonicalizeInsightsSignalDetail(value);
}
