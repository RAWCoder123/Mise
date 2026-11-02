/**
 * Support Settings subtitle restaurant.name identity helpers (MISE-005WE).
 *
 * Pins the Support screen subtitle restaurant interpolation that previously
 * always passed `restaurant.name` into `support.subtitleRestaurant` whenever
 * a signed-in restaurant object existed:
 * `signedIn && restaurant
 *   ? t("support.subtitleRestaurant", { restaurant: restaurant.name })
 *   : t("support.subtitle")`.
 *
 * A Unicode-only-space restaurant name (`"\u2003"`) is non-nullish and truthy
 * as a restaurant-object field, so the intentional generic `support.subtitle`
 * copy was bypassed and the Support Settings subtitle could interpolate a
 * blank-looking restaurant identity. Empty string has the same
 * blank-interpolation bypass. Separately, Unicode `.trim()` on a padded
 * restaurant name (`"\u2003Luna Bistro\u2003".trim() === "Luna Bistro"`) would
 * invent a clean display restaurant identity if that gate Unicode-trimmed
 * before interpolating into `support.subtitleRestaurant`.
 *
 * Single-line restaurant-name tips use ASCII end trim only and preserve NBSP
 * (no fold into plain space). Soft-null when Unicode trim would still strip
 * end padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded restaurant name. Accents and case are preserved. Full C0/DEL
 * control rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **support.subtitleRestaurant** restaurant-name
 * tokens only — the Support Settings subtitle `{restaurant}` interpolation
 * that falls through to `support.subtitle` when soft-null. Not Privacy
 * Settings subtitle restaurant.name (#1036 / MISE-005WD), not Insights hub
 * subtitle restaurant.name (prior tip / MISE-005WC), not Insights analytics
 * profile restaurant-name chip (#969 / MISE-005UE), not Insights subtitle
 * cuisine_type (#1029 / MISE-005VU), not Settings profile restaurant name
 * (#1021 / MISE-005VM), not Sales Import hero restaurant name (#1022 /
 * MISE-005VN), not Today screen title restaurant-name (#968 / MISE-005UD),
 * not restaurant branding initials (#967 / MISE-005UC), not inventory count
 * `subtitleRestaurant`, not Settings workspace switcher `item.name`, and not
 * Home ApprovalsSection card titles. Soft empty / Unicode-padded /
 * control-bearing tokens soft-null so the live `support.subtitle` branch owns
 * the intentional localized fallback. Ordinary ASCII whitespace still trims
 * clean.
 *
 * Complements open Privacy/Insights/Settings/Today restaurant-name tips
 * without sharing those modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Support subtitle restaurant name before it
 * is interpolated into `support.subtitleRestaurant`.
 */
export function asciiTrimSupportSubtitleRestaurantName(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Support subtitle restaurant name under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeSupportSubtitleRestaurantName(
  value: string
): string | null {
  const trimmed = asciiTrimSupportSubtitleRestaurantName(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Support subtitle `restaurant.name` display.
 * Preserves soft empty → null (intentional localized support.subtitle copy)
 * while refusing to invent a clean restaurant name via Unicode em-space /
 * NBSP trim. Does not throw; Unicode-padded / unsafe / non-string tokens
 * return null so the live `support.subtitle` branch owns the fallback without
 * inventing a clean subtitle restaurant identity from padding, and without
 * letting non-nullish Unicode-only space or empty string bypass that fallback
 * through the prior always-interpolate-name row.
 */
export function normalizeSupportSubtitleRestaurantName(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously bypassed the intentional localized support.subtitle copy by
  // still interpolating into support.subtitleRestaurant.
  // Do not invent a clean Support subtitle restaurant label from padding.
  if (!value.trim()) return null;
  return canonicalizeSupportSubtitleRestaurantName(value);
}
