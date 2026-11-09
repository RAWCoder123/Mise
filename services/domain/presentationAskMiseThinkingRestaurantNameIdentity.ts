/**
 * Ask Mise thinkingSteps restaurant.name identity helpers (MISE-005AAY).
 *
 * Pins the Ask Mise thinking-step restaurant interpolation that previously
 * always passed raw `restaurant.name` into `ask.thinking.restaurant`:
 *   `t("ask.thinking.restaurant", { restaurant: input.restaurantName })`
 * where `restaurantName` came from `restaurant.name` with no ASCII C prep.
 *
 * A Unicode-only-space restaurant name (`"\u2003"`) is non-nullish and truthy
 * as a restaurant-object field, so thinking steps still interpolated a
 * blank-looking restaurant identity into `ask.thinking.restaurant`. Empty
 * string has the same blank-interpolation path. Separately, Unicode `.trim()`
 * on a padded restaurant name
 * (`"\u2003Luna Bistro\u2003".trim() === "Luna Bistro"`) would invent a clean
 * thinking-step restaurant identity if that gate Unicode-trimmed before
 * interpolating into `ask.thinking.restaurant`.
 *
 * Single-line restaurant-name tips use ASCII end trim only and preserve NBSP
 * (no fold into plain space). Soft-null when Unicode trim would still strip
 * end padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded restaurant name. Accents and case are preserved. Full C0/DEL
 * control rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **ask.thinking.restaurant** restaurant-name tokens
 * only — the Ask Mise thinkingSteps `{restaurant}` interpolation that falls
 * through to `ask.thinking.restaurant.none` when soft-null. Not Ask Mise
 * greeting.body restaurant.name (#1045 / MISE-005WK), not Ask Mise greeting
 * firstName (#961 / MISE-005TW), not Ask Mise answer-text briefing.lead
 * restaurant.name (sibling tip candidate), not Home greeting restaurant.name
 * (#1044 / MISE-005WJ), not Autonomy subtitle restaurant.name (#1043 /
 * MISE-005WI), not Restaurant Memory / Activity / Support / Privacy / Count /
 * Insights subtitle restaurant-name tips, not Today screen title (#968), not
 * branding initials (#967), not Settings profile / Sales Import / workspace
 * item.name tips, and not Ask Mise answer-text attentionTitles (#1209) /
 * topTaskTitles (#1164). Soft empty / Unicode-padded / control-bearing tokens
 * soft-null so the live `ask.thinking.restaurant.none` branch owns the
 * intentional localized fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1045 / #961 / #1044 / #1043 without sharing those modules
 * or rewriting their call sites. #1045 owns Ask Mise greeting.body restaurant
 * display only and left thinkingSteps restaurant.name alone.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Ask Mise thinkingSteps restaurant name
 * before it is interpolated into `ask.thinking.restaurant`.
 */
export function asciiTrimAskMiseThinkingRestaurantName(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an Ask Mise thinkingSteps restaurant name under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeAskMiseThinkingRestaurantName(
  value: string
): string | null {
  const trimmed = asciiTrimAskMiseThinkingRestaurantName(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Ask Mise thinkingSteps `restaurant.name` display.
 * Preserves soft empty → null (intentional localized
 * ask.thinking.restaurant.none copy) while refusing to invent a clean
 * restaurant name via Unicode em-space / NBSP trim. Does not throw;
 * Unicode-padded / unsafe / non-string tokens return null so the live
 * `ask.thinking.restaurant.none` branch owns the fallback without inventing a
 * clean thinkingSteps restaurant identity from padding, and without letting
 * non-nullish Unicode-only space or empty string bypass that fallback through
 * the prior always-interpolate-name row.
 */
export function normalizeAskMiseThinkingRestaurantName(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still interpolated into ask.thinking.restaurant as a
  // blank-looking restaurant identity.
  // Do not invent a clean Ask Mise thinkingSteps restaurant label from padding.
  if (!value.trim()) return null;
  return canonicalizeAskMiseThinkingRestaurantName(value);
}
