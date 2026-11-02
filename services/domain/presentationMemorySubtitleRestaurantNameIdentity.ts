/**
 * Restaurant Memory subtitle restaurant.name identity helpers (MISE-005WH).
 *
 * Pins the Restaurant Memory screen subtitle restaurant interpolation that
 * previously always passed `restaurant.name` into `memory.subtitle` whenever a
 * restaurant object existed:
 * `restaurant
 *   ? t("memory.subtitle", { restaurant: restaurant.name })
 *   : t("memory.subtitle.none")`.
 *
 * A Unicode-only-space restaurant name (`"\u2003"`) is non-nullish and truthy
 * as a restaurant-object field, so the intentional generic
 * `memory.subtitle.none` copy was bypassed and the Restaurant Memory subtitle
 * could interpolate a blank-looking restaurant identity. Empty string has the
 * same blank-interpolation bypass. Separately, Unicode `.trim()` on a padded
 * restaurant name (`"\u2003Luna Bistro\u2003".trim() === "Luna Bistro"`) would
 * invent a clean display restaurant identity if that gate Unicode-trimmed
 * before interpolating into `memory.subtitle`.
 *
 * Single-line restaurant-name tips use ASCII end trim only and preserve NBSP
 * (no fold into plain space). Soft-null when Unicode trim would still strip
 * end padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded restaurant name. Accents and case are preserved. Full C0/DEL
 * control rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **memory.subtitle** restaurant-name tokens only —
 * the Restaurant Memory subtitle `{restaurant}` interpolation that falls
 * through to `memory.subtitle.none` when soft-null. Not Autonomy subtitle
 * restaurant.name (sibling tip candidate), not Activity History subtitle
 * restaurant.name (#1041 / MISE-005WG), not Support Settings subtitle
 * restaurant.name (#1039 / MISE-005WE), not Privacy Settings subtitle
 * restaurant.name (#1036 / MISE-005WD), not Insights hub subtitle
 * restaurant.name (#1037 / MISE-005WC), not Inventory Count subtitle
 * restaurant.name (#1040 / MISE-005WF), not Settings profile restaurant name
 * (#1021 / MISE-005VM), not Sales Import hero restaurant name (#1022 /
 * MISE-005VN), not Today screen title restaurant-name (#968 / MISE-005UD),
 * not restaurant branding initials (#967 / MISE-005UC), not Settings
 * workspace switcher `item.name`, and not Home ApprovalsSection card titles.
 * Soft empty / Unicode-padded / control-bearing tokens soft-null so the live
 * `memory.subtitle.none` branch owns the intentional localized fallback.
 * Ordinary ASCII whitespace still trims clean.
 *
 * Complements open Support/Privacy/Insights/Count/Activity/Settings/Today
 * restaurant-name tips without sharing those modules or rewriting their call
 * sites. Leaves Autonomy subtitle restaurant.name alone as a sibling tip
 * candidate.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Memory subtitle restaurant name before it
 * is interpolated into `memory.subtitle`.
 */
export function asciiTrimMemorySubtitleRestaurantName(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Restaurant Memory subtitle restaurant name under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeMemorySubtitleRestaurantName(
  value: string
): string | null {
  const trimmed = asciiTrimMemorySubtitleRestaurantName(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Restaurant Memory subtitle `restaurant.name` display.
 * Preserves soft empty → null (intentional localized memory.subtitle.none
 * copy) while refusing to invent a clean restaurant name via Unicode em-space /
 * NBSP trim. Does not throw; Unicode-padded / unsafe / non-string tokens
 * return null so the live `memory.subtitle.none` branch owns the fallback
 * without inventing a clean subtitle restaurant identity from padding, and
 * without letting non-nullish Unicode-only space or empty string bypass that
 * fallback through the prior always-interpolate-name row.
 */
export function normalizeMemorySubtitleRestaurantName(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously bypassed the intentional localized memory.subtitle.none copy
  // by still interpolating into memory.subtitle.
  // Do not invent a clean Restaurant Memory subtitle restaurant label from padding.
  if (!value.trim()) return null;
  return canonicalizeMemorySubtitleRestaurantName(value);
}
