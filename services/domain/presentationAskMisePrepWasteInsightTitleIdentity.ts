/**
 * Ask Mise answer-text prep / waste insight-title identity helpers
 * (MISE-005ABA).
 *
 * Pins the Ask Mise prep / waste reply copy that previously interpolated raw
 * `presentInsight(...).title` into answer strings via `prepTitles` /
 * `wasteTitles`:
 *   `t("ask.answer.prep.named", { items: prepTitles.join("; ") })`
 *   `t("ask.answer.waste.named", { items: wasteTitles.join("; ") })`
 *
 * Structured insight rules (`insight.rule.prep.low_stock`,
 * `insight.rule.sales.demand_rising`, `insight.rule.waste.overstock`) embed
 * free-form menu / inventory item names into localized title templates, for
 * example `prepTitle(menuItemName) => \`${menuItemName} depends on low stock\``.
 * Empty / Unicode-only-space / Unicode-padded free-text item names still
 * produce a non-nullish, truthy composed title
 * (`"\u2003Chicken Bowl\u2003 depends on low stock"`), so Ask Mise answer text
 * could interpolate blank-looking or Unicode-padded insight identity with no
 * intentional localized none marker. Separately, Unicode `.trim()` on a
 * composed title with Unicode end padding invents a clean title before that
 * string is joined into the Ask Mise answer-text `{items}` interpolation
 * (`"\u2003Chicken Bowl depends on low stock\u2003".trim() === "Chicken Bowl depends on low stock"`).
 * The free-text item name alone also invents fully
 * (`"\u2003Chicken Bowl\u2003".trim() === "Chicken Bowl"`).
 *
 * Opaque `insight.evidence.opaque` titles are controlled insight-type labels
 * from `copy.insightType[...]`, but they share this Ask Mise prep / waste
 * join path when filtered into those insight lists, so the same soft-null
 * gate applies before `{items}` interpolation.
 *
 * Single-line prep/waste insight-title tips use ASCII end trim only and
 * preserve NBSP (no fold into plain space). Soft-null when Unicode trim would
 * still strip end padding (NBSP / em-space) so padding cannot invent equality
 * with an unpadded title. Accents and case are preserved. Full C0/DEL control
 * rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **ask.answer.prepWasteInsightTitle.none** title
 * tokens only — the Ask Mise prep / waste answer-text `{items}` join that
 * falls through to that fallback when soft-null. Not Insights InsightListRow
 * presentation.title (#1185 / MISE-005ZZ), not Ask Mise answer-text
 * attentionTitles (#1209 / MISE-005AAX), not Ask Mise answer-text
 * topTaskTitles (#1164 / MISE-005ZF), not Ask Mise sales / priorities /
 * briefing `presentedInsight.title` interpolations (left raw on this tip),
 * not Ask Mise greeting restaurant.name (#1045) / firstName (#961), and not
 * Daily Brief Board finding.title (#1145). Soft empty / Unicode-padded /
 * control-bearing tokens soft-null so the live
 * `|| t("ask.answer.prepWasteInsightTitle.none")` branch owns the intentional
 * localized fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1185 / #1209 / #1164 / #1045 / #961 / #1145 without
 * sharing those modules or rewriting their call sites. #1185 owns Insights
 * InsightListRow title display only and left Ask Mise prep / waste
 * `presentInsight(...).title` joins alone.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Ask Mise prep / waste insight title before
 * it is interpolated into prep / waste reply copy.
 */
export function asciiTrimAskMisePrepWasteInsightTitle(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an Ask Mise prep / waste insight title under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeAskMisePrepWasteInsightTitle(value: string): string | null {
  const trimmed = asciiTrimAskMisePrepWasteInsightTitle(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Ask Mise prep / waste `presentInsight(...).title`
 * entries. Preserves soft empty → null (intentional localized
 * ask.answer.prepWasteInsightTitle.none copy) while refusing to invent a
 * clean insight title via Unicode em-space / NBSP trim. Does not throw;
 * Unicode-padded / unsafe / non-string tokens return null so the live
 * `|| t("ask.answer.prepWasteInsightTitle.none")` branch owns the fallback
 * without inventing a clean Ask Mise prep / waste insight title from padding,
 * and without letting non-nullish Unicode-only space or empty string
 * interpolate a blank-looking title through the prior always-pass path.
 */
export function normalizeAskMisePrepWasteInsightTitle(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still interpolated into answer-text `{items}` instead of the
  // intentional localized ask.answer.prepWasteInsightTitle.none copy.
  // Do not invent a clean Ask Mise prep / waste insight title from padding.
  if (!value.trim()) return null;
  return canonicalizeAskMisePrepWasteInsightTitle(value);
}
