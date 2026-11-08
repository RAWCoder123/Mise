/**
 * Insights InsightListRow presentation.recommendedAction identity helpers
 * (MISE-005AAA).
 *
 * Pins the Insights manager-brief InsightListRow next-action Text that
 * previously always rendered raw `presentation.recommendedAction`:
 *   `<Text style={styles.actionText}>{presentation.recommendedAction}</Text>`
 *
 * Structured insight rules (`insight.rule.*`) embed free-form inventory /
 * menu / supplier names into localized recommended-action templates, for
 * example
 * `salesAction(itemName) => \`Before the next prep window, confirm walk-in counts for ingredients tied to ${itemName}.\``
 * and
 * `inventoryAction(supplierName, quantity, unit) => \`Check the walk-in, then add ${quantity} ${unit} on the next ${supplierName} ticket.\``.
 * Empty / Unicode-only-space / Unicode-padded free-text names still produce a
 * non-nullish, truthy composed recommended action, so blank-looking or
 * Unicode-trimmed InsightListRow action copy could appear on Insights with no
 * intentional localized none marker.
 *
 * When an insight has no presentation descriptor,
 * `insightPresentationDescriptor` / `presentInsight` fall through to
 * `insight.evidence.opaque` and compose
 * `recommendedAction: \`${sourceRecommendationLabel}: ${rawRecommendedAction}\``
 * from free-form `insight.recommended_action`. Empty / Unicode-only-space /
 * Unicode-padded free-text actions still produce a non-nullish, truthy
 * composed action (`"Source recommendation: \u2003"`), so blank-looking
 * InsightListRow next-action copy could appear with no intentional localized
 * none marker. Separately, Unicode `.trim()` on a padded composed action
 * (`"Source recommendation: \u2003Check the walk-in\u2003".trim()`) invents by
 * stripping trailing Unicode padding before that string is rendered into the
 * actionText Text. The free-text recommended action alone also invents fully
 * (`"\u2003Check the walk-in\u2003".trim() === "Check the walk-in"`).
 *
 * Single-line insight-recommended-action tips use ASCII end trim only and
 * preserve NBSP (no fold into plain space). Soft-null when Unicode trim would
 * still strip end padding (NBSP / em-space) so padding cannot invent equality
 * with an unpadded recommended action. Accents and case are preserved. Full
 * C0/DEL control rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **insights.insight.recommendedAction.none** action
 * tokens only — the InsightListRow actionText Text that falls through to that
 * fallback when soft-null. Not Insights InsightListRow presentation.title
 * (#1185 / MISE-005ZZ), not InsightListRow presentation.description
 * (#1184 / MISE-005ZY), not InsightListRow presentation.whyItMatters (left
 * raw on this tip), not Daily Brief Board finding.recommendedAction
 * (#1143 / MISE-005YK), and not Home ApprovalsSection recommendedAction
 * (#1134). Soft empty / Unicode-padded / control-bearing tokens soft-null so
 * the live `|| t("insights.insight.recommendedAction.none")` branch owns the
 * intentional localized fallback. Ordinary ASCII whitespace still trims
 * clean.
 *
 * Complements open #1185 / #1184 / #1143 / #1134 without sharing those
 * modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Insights InsightListRow recommended action
 * before it is rendered into the actionText Text.
 */
export function asciiTrimInsightsInsightRecommendedAction(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an Insights InsightListRow presentation.recommendedAction under
 * ASCII C. Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeInsightsInsightRecommendedAction(
  value: string
): string | null {
  const trimmed = asciiTrimInsightsInsightRecommendedAction(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Insights InsightListRow `presentation.recommendedAction`.
 * Preserves soft empty → null (intentional localized
 * insights.insight.recommendedAction.none copy) while refusing to invent a
 * clean recommended action via Unicode em-space / NBSP trim. Does not throw;
 * Unicode-padded / unsafe / non-string tokens return null so the live
 * `|| t("insights.insight.recommendedAction.none")` branch owns the fallback
 * without inventing a clean InsightListRow recommended action from padding,
 * and without letting non-nullish Unicode-only space or empty string render a
 * blank-looking actionText body through the prior always-pass-action Text.
 */
export function normalizeInsightsInsightRecommendedAction(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered as the actionText body instead of the
  // intentional localized insights.insight.recommendedAction.none copy.
  // Do not invent a clean Insights InsightListRow recommended action from padding.
  if (!value.trim()) return null;
  return canonicalizeInsightsInsightRecommendedAction(value);
}
