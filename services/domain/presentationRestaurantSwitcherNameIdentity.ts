/**
 * RestaurantSwitcher a11y restaurant.name identity helpers (MISE-005XS).
 *
 * Pins the Screen restaurant-chip accessibility interpolation that previously
 * always passed raw `name` into the template:
 * `accessibilityLabel={t("screen.openRestaurantSettings", { restaurant: name })}`
 *
 * A Unicode-only-space restaurant name (`"\u2003"`) is non-nullish and truthy,
 * so VoiceOver / TalkBack labels could include blank-looking restaurant
 * identity with no intentional localized none marker. Empty string has the
 * same always-pass blank-looking path. Separately, Unicode `.trim()` on a
 * padded restaurant name (`"\u2003Luna Bistro\u2003".trim() === "Luna Bistro"`)
 * would invent a clean restaurant identity if that gate Unicode-trimmed before
 * interpolating into the RestaurantSwitcher a11y chrome.
 *
 * Single-line restaurant-name tips use ASCII end trim only and preserve NBSP
 * (no fold into plain space). Soft-null when Unicode trim would still strip
 * end padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded restaurant name. Accents and case are preserved. Full C0/DEL
 * control rejection applies (no LF/TAB/CR allowlist) because this token is
 * interpolated into a single-line accessibility label.
 *
 * These are presentation **screen.openRestaurantSettings.none** restaurant-name
 * tokens only — the RestaurantSwitcher a11y `{restaurant}` interpolation that
 * falls through to that fallback when soft-null. Not the chip display Text
 * `{name}`, not Autonomy subtitle restaurant.name (#1043 / MISE-005WI), not
 * Home greeting restaurant.name (#1044 / MISE-005WJ), not Ask Mise restaurant
 * name (#1045 / MISE-005WK), not Today screen title restaurant name (#968 /
 * MISE-005UD), not Memory/Activity/Support/Privacy/Count/Insights subtitle
 * restaurant.name tips, not Settings profile restaurant name (#1021), and not
 * Settings workspace switcher `item.name`. Soft empty / Unicode-padded /
 * control-bearing tokens soft-null so the live
 * `t("screen.openRestaurantSettings.none")` branch owns the intentional
 * localized fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1043 / #1044 / #1045 / #968 without sharing those modules
 * or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized RestaurantSwitcher a11y restaurant name
 * before it is interpolated into the accessibility label.
 */
export function asciiTrimRestaurantSwitcherName(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a RestaurantSwitcher a11y restaurant name under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeRestaurantSwitcherName(value: string): string | null {
  const trimmed = asciiTrimRestaurantSwitcherName(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for RestaurantSwitcher a11y `name`.
 * Preserves soft empty → null (intentional localized
 * screen.openRestaurantSettings.none copy) while refusing to invent a clean
 * restaurant name via Unicode em-space / NBSP trim. Does not throw;
 * Unicode-padded / unsafe / non-string tokens return null so the live
 * `screen.openRestaurantSettings.none` branch owns the fallback without
 * inventing a clean RestaurantSwitcher a11y restaurant identity from padding,
 * and without letting non-nullish Unicode-only space or empty string
 * interpolate a blank-looking restaurant through the prior always-pass path.
 */
export function normalizeRestaurantSwitcherName(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still interpolated into RestaurantSwitcher a11y instead of the
  // intentional localized screen.openRestaurantSettings.none copy.
  // Do not invent a clean RestaurantSwitcher a11y restaurant label from padding.
  if (!value.trim()) return null;
  return canonicalizeRestaurantSwitcherName(value);
}
