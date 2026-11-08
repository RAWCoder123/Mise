/**
 * Insights InsightListRow presentation.description identity helpers
 * (MISE-005ZY).
 *
 * Pins the Insights manager-brief InsightListRow description Text that
 * previously always rendered raw `presentation.description`:
 *   `<Text style={styles.insightDescription}>{presentation.description}</Text>`
 *
 * When an insight has no presentation descriptor,
 * `insightPresentationDescriptor` / `presentInsight` fall through to
 * `insight.evidence.opaque` and compose
 * `description: \`${evidenceLabel}: ${rawTitle}. ${rawDescription}\`` from
 * free-form `insight.title` and `insight.description`. Empty /
 * Unicode-only-space free-text titles and descriptions still produce a
 * non-nullish, truthy composed description (`"Evidence: \u2003. \u2003"`), so
 * blank-looking InsightListRow copy could appear on Insights with no
 * intentional localized none marker. Separately, Unicode `.trim()` on a
 * padded composed description
 * (`"Evidence: \u2003Roma Tomatoes low\u2003. \u2003Check the walk-in\u2003".trim()`)
 * invents by stripping trailing Unicode padding before that string is
 * rendered into the insightDescription Text. The free-text title alone also
 * invents fully
 * (`"\u2003Roma Tomatoes low\u2003".trim() === "Roma Tomatoes low"`).
 *
 * Structured insight rules (`insight.rule.*`) also embed free-form inventory /
 * menu / supplier names into localized description templates. Those composed
 * descriptions share this InsightListRow display path, so the same soft-null
 * gate refuses Unicode-padded / control-bearing composed copy before render.
 *
 * Single-line insight-description tips use ASCII end trim only and preserve
 * NBSP (no fold into plain space). Soft-null when Unicode trim would still
 * strip end padding (NBSP / em-space) so padding cannot invent equality with
 * an unpadded description. Accents and case are preserved. Full C0/DEL
 * control rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **insights.insight.description.none** description
 * tokens only — the InsightListRow insightDescription Text that falls through
 * to that fallback when soft-null. Not Insights signal presentation.detail
 * (#1166 / MISE-005ZH), not Insights signal presentation.label / value
 * (#1167 / #1168), not How-Mise-knows memory operatorCopy / nextStep / label
 * (#1170 / #1171 / #1169), not Daily Brief Board finding.explanation
 * (#1142), and not InsightListRow presentation.title /
 * presentation.whyItMatters / presentation.recommendedAction (left raw on
 * this tip). Soft empty / Unicode-padded / control-bearing tokens soft-null
 * so the live `|| t("insights.insight.description.none")` branch owns the
 * intentional localized fallback. Ordinary ASCII whitespace still trims
 * clean.
 *
 * Complements open #1166 / #1167 / #1168 / #1170 / #1171 / #1169 / #1142
 * without sharing those modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Insights InsightListRow description before
 * it is rendered into the insightDescription Text.
 */
export function asciiTrimInsightsInsightDescription(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an Insights InsightListRow presentation.description under
 * ASCII C. Returns null when empty after ASCII trim, still Unicode-padded,
 * or containing ASCII controls.
 */
export function canonicalizeInsightsInsightDescription(
  value: string
): string | null {
  const trimmed = asciiTrimInsightsInsightDescription(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Insights InsightListRow `presentation.description`.
 * Preserves soft empty → null (intentional localized
 * insights.insight.description.none copy) while refusing to invent a clean
 * description via Unicode em-space / NBSP trim. Does not throw;
 * Unicode-padded / unsafe / non-string tokens return null so the live
 * `|| t("insights.insight.description.none")` branch owns the fallback
 * without inventing a clean InsightListRow description from padding, and
 * without letting non-nullish Unicode-only space or empty string render a
 * blank-looking insightDescription body through the prior
 * always-pass-description Text.
 */
export function normalizeInsightsInsightDescription(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered as the insightDescription body instead of the
  // intentional localized insights.insight.description.none copy.
  // Do not invent a clean Insights InsightListRow description from padding.
  if (!value.trim()) return null;
  return canonicalizeInsightsInsightDescription(value);
}
