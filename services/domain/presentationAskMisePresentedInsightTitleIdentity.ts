/**
 * Ask Mise answer-text sales / priorities / briefing presentedInsight.title
 * identity helpers (MISE-005ABB).
 *
 * Pins the Ask Mise sales / priorities / briefing reply copy that previously
 * interpolated raw `presentInsight(...).title` into answer strings via
 * `presentedInsight.title`:
 *   `t("ask.answer.sales.insight", { insight: presentedInsight.title })`
 *   `t("ask.answer.prioritiesInsight", { insight: presentedInsight.title })`
 *   briefing tail via the same `ask.answer.prioritiesInsight` key
 *
 * Structured insight rules (`insight.rule.sales.demand_rising`, and any other
 * insight that becomes `insights[0]` / `summary.importantInsight`) embed
 * free-form menu / inventory item names into localized title templates, for
 * example `salesTitle(itemName) => \`${itemName} demand is rising\``. Empty /
 * Unicode-only-space / Unicode-padded free-text item names still produce a
 * non-nullish, truthy composed title
 * (`"\u2003Chicken Bowl\u2003 demand is rising"`), so Ask Mise answer text
 * could interpolate blank-looking or Unicode-padded insight identity with no
 * intentional localized none marker. Separately, Unicode `.trim()` on a
 * composed title with Unicode end padding invents a clean title before that
 * string is interpolated into the Ask Mise answer-text `{insight}` slot
 * (`"\u2003Chicken Bowl demand is rising\u2003".trim() === "Chicken Bowl demand is rising"`).
 * The free-text item name alone also invents fully
 * (`"\u2003Chicken Bowl\u2003".trim() === "Chicken Bowl"`).
 *
 * Opaque `insight.evidence.opaque` titles are controlled insight-type labels
 * from `copy.insightType[...]`, but they share this Ask Mise sales /
 * priorities / briefing `presentedInsight.title` path when selected as the
 * top insight, so the same soft-null gate applies before `{insight}`
 * interpolation.
 *
 * Single-line presentedInsight.title tips use ASCII end trim only and
 * preserve NBSP (no fold into plain space). Soft-null when Unicode trim would
 * still strip end padding (NBSP / em-space) so padding cannot invent equality
 * with an unpadded title. Accents and case are preserved. Full C0/DEL control
 * rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **ask.answer.presentedInsightTitle.none** title
 * tokens only — the Ask Mise sales / priorities / briefing answer-text
 * `{insight}` interpolation that falls through to that fallback when
 * soft-null. Not Insights InsightListRow presentation.title (#1185 /
 * MISE-005ZZ), not Ask Mise prep / waste insight-title joins (#1212 /
 * MISE-005ABA), not Ask Mise answer-text attentionTitles (#1209 /
 * MISE-005AAX), not Ask Mise answer-text topTaskTitles (#1164 / MISE-005ZF),
 * not Ask Mise greeting restaurant.name (#1045) / firstName (#961), and not
 * Daily Brief Board finding.title (#1145). Soft empty / Unicode-padded /
 * control-bearing tokens soft-null so the live
 * `|| t("ask.answer.presentedInsightTitle.none")` branch owns the intentional
 * localized fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1185 / #1212 / #1209 / #1164 / #1045 / #961 / #1145
 * without sharing those modules or rewriting their call sites. #1212 owns
 * Ask Mise prep / waste `presentInsight(...).title` joins only and left
 * sales / priorities / briefing `presentedInsight.title` alone. #1185 owns
 * Insights InsightListRow title display only and left Ask Mise
 * presentedInsight.title interpolations alone.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Ask Mise presentedInsight title before it
 * is interpolated into sales / priorities / briefing reply copy.
 */
export function asciiTrimAskMisePresentedInsightTitle(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an Ask Mise presentedInsight.title under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeAskMisePresentedInsightTitle(value: string): string | null {
  const trimmed = asciiTrimAskMisePresentedInsightTitle(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Ask Mise sales / priorities / briefing
 * `presentedInsight.title`. Preserves soft empty → null (intentional
 * localized ask.answer.presentedInsightTitle.none copy) while refusing to
 * invent a clean insight title via Unicode em-space / NBSP trim. Does not
 * throw; Unicode-padded / unsafe / non-string tokens return null so the live
 * `|| t("ask.answer.presentedInsightTitle.none")` branch owns the fallback
 * without inventing a clean Ask Mise presentedInsight title from padding, and
 * without letting non-nullish Unicode-only space or empty string interpolate
 * a blank-looking title through the prior always-pass path.
 */
export function normalizeAskMisePresentedInsightTitle(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still interpolated into answer-text `{insight}` instead of the
  // intentional localized ask.answer.presentedInsightTitle.none copy.
  // Do not invent a clean Ask Mise presentedInsight title from padding.
  if (!value.trim()) return null;
  return canonicalizeAskMisePresentedInsightTitle(value);
}
