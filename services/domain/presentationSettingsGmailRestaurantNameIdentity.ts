/**
 * Settings Gmail connectionSubtitle restaurant.name identity helpers (MISE-005WN).
 *
 * Pins Settings Gmail connection-card restaurant-name presentation that
 * previously always passed raw `restaurant.name` into the connectionSubtitle
 * Text under `settings.gmail.card.title`:
 * `<Text style={styles.connectionSubtitle}>{restaurant.name}</Text>`
 *
 * A Unicode-only-space restaurant name (`"\u2003"`) is non-nullish and still
 * rendered as the entire connectionSubtitle line, so blank-looking restaurant
 * identity appeared under the Restaurant Gmail card with no intentional
 * localized fallback. Empty string has the same blank-subtitle bypass.
 * Separately, Unicode `.trim()` on a padded restaurant name
 * (`"\u2003Luna Bistro\u2003".trim() === "Luna Bistro"`) would invent a clean
 * display restaurant identity if that gate Unicode-trimmed before rendering
 * into the Settings Gmail connectionSubtitle.
 *
 * Single-line restaurant-name tips use ASCII end trim only and preserve NBSP
 * (no fold into plain space). Soft-null when Unicode trim would still strip
 * end padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded restaurant name. Accents and case are preserved. Full C0/DEL
 * control rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **settings.gmail.connectionSubtitle.none** restaurant-
 * name tokens only — the Settings Gmail connectionSubtitle `restaurant.name`
 * that falls through to that fallback when soft-null. Not Settings Gmail
 * sender_email display (#1019 / MISE-005VK), not Orders Gmail connected-body
 * sender (#1020 / MISE-005VL), not setup-readiness Gmail sender_email
 * (#1031 / MISE-005VW), not Settings workspace item.name (#1047 /
 * MISE-005WM), not Settings workspace cuisine (#1023 / MISE-005VO), not
 * Settings hub restaurant-name (#1021 / MISE-005VM), not Sales Import hero
 * restaurant-name (#1022 / MISE-005VN), not Team Settings subtitle
 * restaurant.name (#1046 / MISE-005WL), not Ask Mise greeting restaurant.name
 * (#1045 / MISE-005WK), not Home greeting restaurant.name (#1044 /
 * MISE-005WJ), not Autonomy / Memory / Activity / Support / Privacy / Count /
 * Insights subtitle restaurant.name tips, not Today screen title
 * restaurant-name (#968 / MISE-005UD), not restaurant branding initials
 * (#967 / MISE-005UC), and not Home ApprovalsSection card titles. Soft empty
 * / Unicode-padded / control-bearing tokens soft-null so the live
 * `|| t("settings.gmail.connectionSubtitle.none")` branch owns the
 * intentional localized fallback. Ordinary ASCII whitespace still trims
 * clean.
 *
 * Complements open #1047 / #1046 / #1045 / #1044 / #1043 / #1042 / #1041 /
 * #1040 / #1039 / #1037 / #1036 / #1032 / #1031 / #1023 / #1022 / #1021 /
 * #1020 / #1019 / #968 / #967 on other presentation tips without sharing
 * those modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Settings Gmail restaurant name before it
 * is rendered into the connectionSubtitle Text.
 */
export function asciiTrimSettingsGmailRestaurantName(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Settings Gmail restaurant name under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeSettingsGmailRestaurantName(
  value: string
): string | null {
  const trimmed = asciiTrimSettingsGmailRestaurantName(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Settings Gmail connectionSubtitle `restaurant.name`
 * display. Preserves soft empty → null (intentional localized
 * connectionSubtitle.none copy) while refusing to invent a clean restaurant
 * name via Unicode em-space / NBSP trim. Does not throw; Unicode-padded /
 * unsafe / non-string tokens return null so the live
 * `|| t("settings.gmail.connectionSubtitle.none")` branch owns the fallback
 * without inventing a clean Gmail connection restaurant identity from
 * padding, and without letting non-nullish Unicode-only space or empty
 * string render a blank-looking connectionSubtitle through the prior
 * always-pass-name row.
 */
export function normalizeSettingsGmailRestaurantName(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered as the connectionSubtitle Text instead of the
  // intentional localized connectionSubtitle.none copy.
  // Do not invent a clean Settings Gmail restaurant label from padding.
  if (!value.trim()) return null;
  return canonicalizeSettingsGmailRestaurantName(value);
}
