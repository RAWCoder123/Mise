/**
 * Insights InsightListRow presentation.title identity helpers
 * (MISE-005ZZ).
 *
 * Pins the Insights manager-brief InsightListRow title Text that previously
 * always rendered raw `presentation.title`:
 *   `<Text style={styles.insightTitle}>{presentation.title}</Text>`
 *
 * Structured insight rules (`insight.rule.*`) embed free-form inventory /
 * menu item names into localized title templates, for example
 * `inventoryCriticalTitle(itemName) => \`${itemName} may run out today\``.
 * Empty / Unicode-only-space / Unicode-padded free-text item names still
 * produce a non-nullish, truthy composed title
 * (`"\u2003Roma Tomatoes\u2003 may run out today"`), so blank-looking or
 * Unicode-trimmed InsightListRow titles could appear on Insights with no
 * intentional localized none marker. Separately, Unicode `.trim()` on a
 * padded composed title invents a clean title before that string is rendered
 * into the insightTitle Text
 * (`"\u2003Roma Tomatoes\u2003 may run out today".trim() === "Roma Tomatoes may run out today"`).
 * The free-text item name alone also invents fully
 * (`"\u2003Roma Tomatoes\u2003".trim() === "Roma Tomatoes"`).
 *
 * Opaque `insight.evidence.opaque` titles are controlled insight-type labels
 * from `copy.insightType[...]`, but they share this InsightListRow display
 * path, so the same soft-null gate applies before render.
 *
 * Single-line insight-title tips use ASCII end trim only and preserve NBSP
 * (no fold into plain space). Soft-null when Unicode trim would still strip
 * end padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded title. Accents and case are preserved. Full C0/DEL control
 * rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **insights.insight.title.none** title tokens only —
 * the InsightListRow insightTitle Text that falls through to that fallback
 * when soft-null. Not Insights InsightListRow presentation.description
 * (#1184 / MISE-005ZY), not Insights signal presentation.detail / label /
 * value (#1166 / #1167 / #1168), not How-Mise-knows memory operatorCopy /
 * nextStep / label (#1170 / #1171 / #1169), not Daily Brief Board
 * finding.title (#1145), and not InsightListRow presentation.whyItMatters /
 * presentation.recommendedAction (left raw on this tip). Soft empty /
 * Unicode-padded / control-bearing tokens soft-null so the live
 * `|| t("insights.insight.title.none")` branch owns the intentional
 * localized fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1184 / #1166 / #1167 / #1168 / #1170 / #1171 / #1169 /
 * #1145 without sharing those modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Insights InsightListRow title before it is
 * rendered into the insightTitle Text.
 */
export function asciiTrimInsightsInsightTitle(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an Insights InsightListRow presentation.title under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeInsightsInsightTitle(value: string): string | null {
  const trimmed = asciiTrimInsightsInsightTitle(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Insights InsightListRow `presentation.title`.
 * Preserves soft empty → null (intentional localized
 * insights.insight.title.none copy) while refusing to invent a clean title
 * via Unicode em-space / NBSP trim. Does not throw; Unicode-padded / unsafe /
 * non-string tokens return null so the live
 * `|| t("insights.insight.title.none")` branch owns the fallback without
 * inventing a clean InsightListRow title from padding, and without letting
 * non-nullish Unicode-only space or empty string render a blank-looking
 * insightTitle body through the prior always-pass-title Text.
 */
export function normalizeInsightsInsightTitle(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered as the insightTitle body instead of the
  // intentional localized insights.insight.title.none copy.
  // Do not invent a clean Insights InsightListRow title from padding.
  if (!value.trim()) return null;
  return canonicalizeInsightsInsightTitle(value);
}
