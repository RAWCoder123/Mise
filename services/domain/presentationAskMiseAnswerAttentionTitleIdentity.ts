/**
 * Ask Mise answer-text attentionTitles identity helpers (MISE-005AAX).
 *
 * Pins the Ask Mise stock / orders reply copy that previously interpolated
 * raw `attentionCards[].title` into answer strings via `attentionTitles`:
 *   `t("ask.answer.stock.named", { items: attentionTitles.join("; ") })`
 *   `t("ask.answer.orders.named", { items: attentionTitles.join("; ") })`
 *
 * Attention-card titles are free-form restaurant operational labels (item
 * names, risk phrases, insight titles). A Unicode-only-space title
 * (`"\u2003"`) is non-nullish and truthy, so Ask Mise answer text could
 * interpolate blank-looking attention identity with no intentional localized
 * none marker. Empty string has the same always-pass blank-looking path.
 * Separately, Unicode `.trim()` on a padded attention title
 * (`"\u2003Chicken thigh low\u2003".trim() === "Chicken thigh low"`) would
 * invent a clean attention identity if that gate Unicode-trimmed before
 * joining into the Ask Mise answer-text `{items}` interpolation.
 *
 * Single-line attention-title tips use ASCII end trim only and preserve NBSP
 * (no fold into plain space). Soft-null when Unicode trim would still strip
 * end padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded attention title. Accents and case are preserved. Full C0/DEL
 * control rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **ask.answer.attentionTitle.none** title tokens only
 * — the Ask Mise answer-text `attentionTitles` join that falls through to that
 * fallback when soft-null. Not Home ApprovalsSection card.title (#1049 /
 * MISE-005WO), not Ask Mise answer-text topTaskTitles (#1164 / MISE-005ZF),
 * not Ask Mise priority-list presentation.title (#1163), not Ask Mise
 * greeting restaurant.name (#1045), not Ask Mise greeting firstName (#961),
 * not Insights InsightListRow presentation.title (#1185), and not Daily Brief
 * Board finding.title (#1145). Soft empty / Unicode-padded / control-bearing
 * tokens soft-null so the live `|| t("ask.answer.attentionTitle.none")`
 * branch owns the intentional localized fallback. Ordinary ASCII whitespace
 * still trims clean.
 *
 * Complements open #1049 / #1164 / #1163 / #1045 / #961 / #1185 / #1145
 * without sharing those modules or rewriting their call sites. #1049 owns
 * Home Approvals cardTitle display only and left Ask Mise attentionTitles
 * alone.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Ask Mise answer-text attention title before
 * it is interpolated into stock / orders reply copy.
 */
export function asciiTrimAskMiseAnswerAttentionTitle(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an Ask Mise answer-text attentionTitles title under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeAskMiseAnswerAttentionTitle(value: string): string | null {
  const trimmed = asciiTrimAskMiseAnswerAttentionTitle(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Ask Mise answer-text `attentionTitles` entries.
 * Preserves soft empty → null (intentional localized
 * ask.answer.attentionTitle.none copy) while refusing to invent a clean
 * attention title via Unicode em-space / NBSP trim. Does not throw;
 * Unicode-padded / unsafe / non-string tokens return null so the live
 * `|| t("ask.answer.attentionTitle.none")` branch owns the fallback without
 * inventing a clean Ask Mise answer-text attention title from padding, and
 * without letting non-nullish Unicode-only space or empty string interpolate
 * a blank-looking title through the prior always-pass path.
 */
export function normalizeAskMiseAnswerAttentionTitle(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still interpolated into answer-text `{items}` instead of the
  // intentional localized ask.answer.attentionTitle.none copy.
  // Do not invent a clean Ask Mise answer-text attention title from padding.
  if (!value.trim()) return null;
  return canonicalizeAskMiseAnswerAttentionTitle(value);
}
