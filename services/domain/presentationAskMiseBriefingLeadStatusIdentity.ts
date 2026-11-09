/**
 * Ask Mise answer-text briefing.lead `{status}` identity helpers (MISE-005ABC).
 *
 * Pins the Ask Mise briefing reply copy that previously interpolated raw
 * `summary.miseStatus` into answer strings via:
 *   `t("ask.answer.briefing.lead", { restaurant, status: summary.miseStatus })`
 *
 * `AskMiseRestaurantContext.miseStatus` is an opaque free string (tests and
 * future dynamic producers inject short labels such as `Ready` / `Watch`, and
 * domain summary currently ships a longer English sentence). A
 * Unicode-only-space status (`"\u2003"`) is non-nullish and truthy, so Ask Mise
 * briefing answer text could interpolate blank-looking status identity with no
 * intentional localized none marker. Empty string has the same always-pass
 * blank-looking path. Separately, Unicode `.trim()` on a padded status
 * (`"\u2003Ready\u2003".trim() === "Ready"`) would invent a clean status
 * identity if that gate Unicode-trimmed before interpolating into the Ask Mise
 * briefing.lead `{status}` slot.
 *
 * Single-line briefing status tips use ASCII end trim only and preserve NBSP
 * (no fold into plain space). Soft-null when Unicode trim would still strip
 * end padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded status. Accents and case are preserved. Full C0/DEL control
 * rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **ask.answer.briefing.status.none** status tokens
 * only — the Ask Mise briefing.lead `{status}` interpolation that falls
 * through to that fallback when soft-null. Not Ask Mise briefing.lead
 * restaurant.name (#1211 / MISE-005AAZ), not Ask Mise thinkingSteps
 * restaurant.name (#1210 / MISE-005AAY), not Ask Mise greeting.body
 * restaurant.name (#1045), not Ask Mise greeting firstName (#961), not Daily
 * Report Badge `day.miseStatus` display, not Home StatusNotice surfaces, and
 * not Ask Mise attentionTitles (#1209) / topTaskTitles (#1164). Soft empty /
 * Unicode-padded / control-bearing tokens soft-null so the live
 * `|| t("ask.answer.briefing.status.none")` branch owns the intentional
 * localized fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1211 / #1210 / #1045 / #961 / #1209 / #1164 without sharing
 * those modules or rewriting their call sites. #1211 owns Ask Mise
 * briefing.lead restaurant.name soft-null only and left `{status}` /
 * `summary.miseStatus` alone on both the lead and lead.none branches.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Ask Mise briefing.lead status before it is
 * interpolated into briefing reply copy.
 */
export function asciiTrimAskMiseBriefingLeadStatus(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an Ask Mise briefing.lead `{status}` value under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeAskMiseBriefingLeadStatus(value: string): string | null {
  const trimmed = asciiTrimAskMiseBriefingLeadStatus(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Ask Mise briefing.lead `summary.miseStatus`.
 * Preserves soft empty → null (intentional localized
 * ask.answer.briefing.status.none copy) while refusing to invent a clean
 * status via Unicode em-space / NBSP trim. Does not throw; Unicode-padded /
 * unsafe / non-string tokens return null so the live
 * `|| t("ask.answer.briefing.status.none")` branch owns the fallback without
 * inventing a clean Ask Mise briefing status from padding, and without letting
 * non-nullish Unicode-only space or empty string interpolate a blank-looking
 * status through the prior always-pass path.
 */
export function normalizeAskMiseBriefingLeadStatus(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still interpolated into briefing.lead `{status}` instead of the
  // intentional localized ask.answer.briefing.status.none copy.
  // Do not invent a clean Ask Mise briefing status from padding.
  if (!value.trim()) return null;
  return canonicalizeAskMiseBriefingLeadStatus(value);
}
