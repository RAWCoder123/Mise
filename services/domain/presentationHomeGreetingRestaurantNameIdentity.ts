/**
 * Home greeting subtext restaurant.name identity helpers (MISE-005WJ).
 *
 * Pins the Home greeting subtext restaurant interpolation that previously
 * always passed `restaurant.name` into `home.greeting.subtext` whenever a
 * restaurant object existed past the early no-restaurant return:
 * `t("home.greeting.subtext", { restaurant: restaurant.name })`.
 *
 * A Unicode-only-space restaurant name (`"\u2003"`) is non-nullish and truthy
 * as a restaurant-object field, so the greeting subtext still interpolated a
 * blank-looking restaurant identity into `home.greeting.subtext`. Empty string
 * has the same blank-interpolation path. Separately, Unicode `.trim()` on a
 * padded restaurant name (`"\u2003Luna Bistro\u2003".trim() === "Luna Bistro"`)
 * would invent a clean display restaurant identity if that gate
 * Unicode-trimmed before interpolating into `home.greeting.subtext`.
 *
 * Single-line restaurant-name tips use ASCII end trim only and preserve NBSP
 * (no fold into plain space). Soft-null when Unicode trim would still strip
 * end padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded restaurant name. Accents and case are preserved. Full C0/DEL
 * control rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **home.greeting.subtext** restaurant-name tokens only
 * — the Home greeting `{restaurant}` interpolation that falls through to
 * `home.greeting.subtext.none` when soft-null. Not Autonomy subtitle
 * restaurant.name (#1043 / MISE-005WI), not Restaurant Memory subtitle
 * restaurant.name (#1042 / MISE-005WH), not Activity History subtitle
 * restaurant.name (#1041 / MISE-005WG), not Support Settings subtitle
 * restaurant.name (#1039 / MISE-005WE), not Privacy Settings subtitle
 * restaurant.name (#1036 / MISE-005WD), not Insights hub subtitle
 * restaurant.name (#1037 / MISE-005WC), not Inventory Count subtitle
 * restaurant.name (#1040 / MISE-005WF), not Settings profile restaurant name
 * (#1021 / MISE-005VM), not Sales Import hero restaurant name (#1022 /
 * MISE-005VN), not Today screen title restaurant-name (#968 / MISE-005UD),
 * not restaurant branding initials (#967 / MISE-005UC), not Ask Mise
 * restaurant.name (sibling tip candidate), not Settings workspace switcher
 * `item.name`, not team subtitle restaurant.name, and not Home
 * ApprovalsSection card titles. Soft empty / Unicode-padded / control-bearing
 * tokens soft-null so the live `home.greeting.subtext.none` branch owns the
 * intentional localized fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open Autonomy/Memory/Activity/Support/Privacy/Insights/Count/
 * Settings/Today restaurant-name tips without sharing those modules or
 * rewriting their call sites. Leaves Ask Mise restaurant.name alone as a
 * sibling tip candidate.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Home greeting restaurant name before it
 * is interpolated into `home.greeting.subtext`.
 */
export function asciiTrimHomeGreetingRestaurantName(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Home greeting restaurant name under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeHomeGreetingRestaurantName(
  value: string
): string | null {
  const trimmed = asciiTrimHomeGreetingRestaurantName(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Home greeting `restaurant.name` display.
 * Preserves soft empty → null (intentional localized home.greeting.subtext.none
 * copy) while refusing to invent a clean restaurant name via Unicode em-space /
 * NBSP trim. Does not throw; Unicode-padded / unsafe / non-string tokens
 * return null so the live `home.greeting.subtext.none` branch owns the fallback
 * without inventing a clean greeting restaurant identity from padding, and
 * without letting non-nullish Unicode-only space or empty string bypass that
 * fallback through the prior always-interpolate-name row.
 */
export function normalizeHomeGreetingRestaurantName(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still interpolated into home.greeting.subtext as a
  // blank-looking restaurant identity.
  // Do not invent a clean Home greeting restaurant label from padding.
  if (!value.trim()) return null;
  return canonicalizeHomeGreetingRestaurantName(value);
}
