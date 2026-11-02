/**
 * Settings workspace switcher item.name identity helpers (MISE-005WM).
 *
 * Pins Settings workspace switcher restaurant-name presentation that
 * previously always passed raw `item.name` into the workspace name Text and
 * into the accessibility label interpolation:
 * `t("settings.workspace.currentAccessibility" | "settings.workspace.switchAccessibility",
 *   { restaurant: item.name })`
 * and `{item.name}` as the workspace row title.
 *
 * A Unicode-only-space restaurant name (`"\u2003"`) is non-nullish and still
 * rendered as the entire workspace name line, and is still interpolated into
 * the accessibility templates, so the intentional localized
 * `settings.workspace.metaFallback` copy was never reached for empty/blank-
 * looking restaurant identity. Empty string has the same blank-name /
 * blank-a11y bypass. Separately, Unicode `.trim()` on a padded restaurant
 * name (`"\u2003Luna Bistro\u2003".trim() === "Luna Bistro"`) would invent a
 * clean display restaurant identity if that gate Unicode-trimmed before
 * rendering into the Settings workspace switcher name or a11y label.
 *
 * Single-line restaurant-name tips use ASCII end trim only and preserve NBSP
 * (no fold into plain space). Soft-null when Unicode trim would still strip
 * end padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded restaurant name. Accents and case are preserved. Full C0/DEL
 * control rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **settings.workspace.metaFallback** restaurant-name
 * tokens only — the Settings workspace switcher `item.name` that falls
 * through to that fallback when soft-null. Not Settings workspace cuisine
 * meta (`item.cuisine_type ?? metaFallback`, open #1023 / MISE-005VO), not
 * Settings hub restaurant-name (#1021 / MISE-005VM), not Sales Import hero
 * restaurant-name (#1022 / MISE-005VN), not Team Settings subtitle
 * restaurant.name (#1046 / MISE-005WL), not Ask Mise greeting restaurant.name
 * (#1045 / MISE-005WK), not Home greeting restaurant.name (#1044 /
 * MISE-005WJ), not Autonomy / Memory / Activity / Support / Privacy / Count /
 * Insights subtitle restaurant.name tips, not Today screen title
 * restaurant-name (#968 / MISE-005UD), not restaurant branding initials
 * (#967 / MISE-005UC), and not Home ApprovalsSection card titles. Soft empty
 * / Unicode-padded / control-bearing tokens soft-null so the live
 * `|| t("settings.workspace.metaFallback")` branch owns the intentional
 * localized fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1046 / #1045 / #1044 / #1043 / #1042 / #1041 / #1040 /
 * #1039 / #1037 / #1036 / #1023 / #1022 / #1021 / #968 / #967 on other
 * presentation tips without sharing those modules or rewriting their call
 * sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Settings workspace restaurant name before
 * it is rendered into the Settings workspace name Text or a11y label.
 */
export function asciiTrimSettingsWorkspaceRestaurantName(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Settings workspace restaurant name under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeSettingsWorkspaceRestaurantName(
  value: string
): string | null {
  const trimmed = asciiTrimSettingsWorkspaceRestaurantName(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Settings workspace switcher `item.name` display.
 * Preserves soft empty → null (intentional localized metaFallback copy) while
 * refusing to invent a clean restaurant name via Unicode em-space / NBSP trim.
 * Does not throw; Unicode-padded / unsafe / non-string tokens return null so
 * the live `|| t("settings.workspace.metaFallback")` branch owns the fallback
 * without inventing a clean workspace restaurant identity from padding, and
 * without letting non-nullish Unicode-only space or empty string render a
 * blank-looking workspace name / a11y restaurant token through the prior
 * always-pass-name row.
 */
export function normalizeSettingsWorkspaceRestaurantName(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered as the workspace name Text and a11y restaurant
  // token instead of the intentional localized metaFallback copy.
  // Do not invent a clean Settings workspace restaurant label from padding.
  if (!value.trim()) return null;
  return canonicalizeSettingsWorkspaceRestaurantName(value);
}
