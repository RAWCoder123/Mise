/**
 * RestaurantSwitcher chip display restaurant.name identity helpers (MISE-005ZN).
 *
 * Pins the Screen restaurant-chip display Text that previously always rendered
 * raw `name`:
 *   `<Text numberOfLines={1} style={styles.label}>{name}</Text>`
 *
 * A Unicode-only-space restaurant name (`"\u2003"`) is non-nullish and still
 * rendered as the entire chip label, so blank-looking restaurant identity
 * appeared under the Mise wordmark with no intentional localized none marker.
 * Empty string has the same blank-body bypass. Separately, Unicode `.trim()` on
 * a padded restaurant name (`"\u2003Luna Bistro\u2003".trim() === "Luna Bistro"`)
 * would invent a clean restaurant identity if that gate Unicode-trimmed before
 * rendering into the RestaurantSwitcher chip display Text.
 *
 * Single-line restaurant-name tips use ASCII end trim only and preserve NBSP
 * (no fold into plain space). Soft-null when Unicode trim would still strip
 * end padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded restaurant name. Accents and case are preserved. Full C0/DEL
 * control rejection applies (no LF/TAB/CR allowlist) because this token is
 * rendered as a single-line chip label.
 *
 * These are presentation **screen.restaurantSwitcher.name.none** restaurant-name
 * tokens only — the RestaurantSwitcher chip display `{name}` that falls through
 * to that fallback when soft-null. Not RestaurantSwitcher a11y restaurant name
 * (#1079 / MISE-005XS), not Autonomy subtitle restaurant.name (#1043 /
 * MISE-005WI), not Home greeting restaurant.name (#1044 / MISE-005WJ), not Ask
 * Mise restaurant.name (#1045 / MISE-005WK), not Today screen title restaurant
 * name (#968 / MISE-005UD), and not Settings profile / workspace restaurant
 * name tips. Soft empty / Unicode-padded / control-bearing tokens soft-null so
 * the live `|| t("screen.restaurantSwitcher.name.none")` branch owns the
 * intentional localized fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1079 / #1043 / #1044 / #1045 / #968 without sharing those
 * modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized RestaurantSwitcher display restaurant name
 * before it is rendered into the chip label Text.
 */
export function asciiTrimRestaurantSwitcherDisplayName(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a RestaurantSwitcher chip display restaurant name under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeRestaurantSwitcherDisplayName(value: string): string | null {
  const trimmed = asciiTrimRestaurantSwitcherDisplayName(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for RestaurantSwitcher chip display `name`.
 * Preserves soft empty → null (intentional localized
 * screen.restaurantSwitcher.name.none copy) while refusing to invent a clean
 * restaurant name via Unicode em-space / NBSP trim. Does not throw;
 * Unicode-padded / unsafe / non-string tokens return null so the live
 * `|| t("screen.restaurantSwitcher.name.none")` branch owns the fallback without
 * inventing a clean RestaurantSwitcher chip label from padding, and without
 * letting non-nullish Unicode-only space or empty string render a
 * blank-looking chip through the prior always-pass-name Text.
 */
export function normalizeRestaurantSwitcherDisplayName(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered as the chip label instead of the intentional
  // localized screen.restaurantSwitcher.name.none copy.
  // Do not invent a clean RestaurantSwitcher display restaurant label from padding.
  if (!value.trim()) return null;
  return canonicalizeRestaurantSwitcherDisplayName(value);
}
