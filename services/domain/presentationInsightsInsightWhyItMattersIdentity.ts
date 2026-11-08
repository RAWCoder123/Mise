/**
 * Insights InsightListRow presentation.whyItMatters identity helpers
 * (MISE-005AAB).
 *
 * Pins the Insights manager-brief InsightListRow why-it-matters evidence Text
 * that previously truthy-gated raw `presentation.whyItMatters`:
 *   `{presentation.whyItMatters ? (
 *      <Text style={styles.insightEvidence}>
 *        <Text style={styles.insightEvidenceLabel}>{t("insights.whyItMatters")}</Text>
 *        {presentation.whyItMatters}
 *      </Text>
 *    ) : null}`
 *
 * When an insight has no presentation descriptor,
 * `insightPresentationDescriptor` / `presentInsight` fall through to
 * `insight.evidence.opaque` and compose
 * `whyItMatters: \`${evidenceLabel}: ${rawWhyItMatters}\`` from free-form
 * `insight.why_it_matters` whenever that raw field is truthy. Empty /
 * Unicode-only-space / Unicode-padded free-text why copy still produces a
 * non-nullish, truthy composed why
 * (`"Evidence: \u2003"` / `"Evidence: \u2003Stock may not cover service.\u2003"`),
 * so blank-looking InsightListRow evidence could open the truthy gate and
 * render with no intentional hide. Separately, Unicode `.trim()` on a padded
 * composed why invents a clean evidence string before that string is rendered
 * into the insightEvidence Text
 * (`"Evidence: \u2003Stock may not cover service.\u2003".trim() ===
 * "Evidence: Stock may not cover service."`). The free-text why alone also
 * invents fully
 * (`"\u2003Stock may not cover service.\u2003".trim() ===
 * "Stock may not cover service."`).
 *
 * Structured insight rules (`insight.rule.*`) emit controlled localized why
 * copy that shares this InsightListRow display path, so the same soft-null
 * gate refuses Unicode-padded / control-bearing composed copy before render.
 *
 * Single-line insight-why tips use ASCII end trim only and preserve NBSP
 * (no fold into plain space). Soft-null when Unicode trim would still strip
 * end padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded why. Accents and case are preserved. Full C0/DEL control
 * rejection applies (no LF/TAB/CR allowlist).
 *
 * Soft-null closes the live truthy InsightListRow why gate (hide the evidence
 * row) rather than inventing a localized none body. Not Insights InsightListRow
 * presentation.title (#1185 / MISE-005ZZ), not presentation.description
 * (#1184 / MISE-005ZY), not presentation.recommendedAction (#1186 /
 * MISE-005AAA), not Home StatusNotice whyItMatters (#1136 / MISE-005YD), not
 * Home ApprovalsSection whyItMatters (#1135 / MISE-005YC), and not Today
 * sales-spike why_it_matters (#1038 / MISE-005WB). Soft empty /
 * Unicode-padded / control-bearing tokens soft-null so the live
 * `whyItMatters ? (...) : null` branch owns the intentional hide without
 * inventing clean InsightListRow why equality from padding, and without
 * letting non-nullish Unicode-only space open a blank-looking evidence row.
 * Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1186 / #1185 / #1184 / #1136 / #1135 / #1038 without
 * sharing those modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Insights InsightListRow why before it is
 * rendered into the insightEvidence Text.
 */
export function asciiTrimInsightsInsightWhyItMatters(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an Insights InsightListRow presentation.whyItMatters under
 * ASCII C. Returns null when empty after ASCII trim, still Unicode-padded,
 * or containing ASCII controls.
 */
export function canonicalizeInsightsInsightWhyItMatters(
  value: string
): string | null {
  const trimmed = asciiTrimInsightsInsightWhyItMatters(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Insights InsightListRow `presentation.whyItMatters`.
 * Preserves soft empty → null (intentional hide of the why evidence row)
 * while refusing to invent a clean why via Unicode em-space / NBSP trim.
 * Does not throw; Unicode-padded / unsafe / non-string tokens return null so
 * the live `whyItMatters ? (...) : null` branch owns the intentional hide
 * without inventing a clean InsightListRow why from padding, and without
 * letting non-nullish Unicode-only space or empty string open a
 * blank-looking insightEvidence body through the prior truthy-gated why Text.
 */
export function normalizeInsightsInsightWhyItMatters(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still opened the InsightListRow why gate instead of the
  // intentional hide.
  // Do not invent a clean Insights InsightListRow why from padding.
  if (!value.trim()) return null;
  return canonicalizeInsightsInsightWhyItMatters(value);
}
