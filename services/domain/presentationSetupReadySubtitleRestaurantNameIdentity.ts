/**
 * Setup ready-screen subtitle restaurant identity helpers (MISE-005ABK).
 *
 * Pins the setup completion Screen subtitle that previously always passed
 * raw local `readyName` (set from the setup form `restaurantName` after a
 * successful save) into:
 *   t("setup.ready.subtitle", { restaurant: readyName })
 *
 * Setup emptiness / validation gates Unicode-trim (`restaurantName.trim()`),
 * so Unicode-padded names such as `"\u2003Luna Bistro\u2003"` pass as
 * non-empty while `setReadyName(restaurantName)` still stores the padded
 * form. Separately, Unicode `.trim()` on that padded readyName
 * (`"\u2003Luna Bistro\u2003".trim() === "Luna Bistro"`) would invent a
 * clean display restaurant identity if that gate Unicode-trimmed before
 * interpolating into `setup.ready.subtitle`. Soft-null empty /
 * Unicode-only-space / control-bearing tokens so localized
 * `setup.ready.subtitle.none` owns blank-looking ready-screen chrome.
 *
 * Single-line restaurant-name tips use ASCII end trim only and preserve NBSP
 * (no fold into plain space). Soft-null when Unicode trim would still strip
 * end padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded restaurant name. Accents and case are preserved. Full C0/DEL
 * control rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **setup.ready.subtitle** restaurant-name tokens
 * only — the post-setup Screen `{restaurant}` interpolation that falls
 * through to `setup.ready.subtitle.none` when soft-null. Not durable
 * restaurant-name write canonicalize (#844 / MISE-005PJ
 * `restaurantNameIdentity` / `requireRestaurantName`), not Home greeting
 * subtext restaurant.name (#1044 / MISE-005WJ), not Ask Mise greeting
 * restaurant.name (#1045 / MISE-005WK), not Today screen title
 * restaurant-name (#968 / MISE-005UD), not Autonomy / Memory / Activity /
 * Support / Privacy / Insights / Count subtitle restaurant.name tips, and
 * not Settings profile restaurant name. Soft empty / Unicode-padded /
 * control-bearing tokens soft-null so the live `setup.ready.subtitle.none`
 * branch owns the intentional localized fallback. Ordinary ASCII whitespace
 * still trims clean.
 *
 * Complements open #844 write-path restaurant-name ASCII C without sharing
 * that module or rewriting durable name persistence. Owns only the setup
 * ready Screen subtitle interpolate.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized setup.ready.subtitle restaurant name
 * before it is interpolated into the ready Screen subtitle.
 */
export function asciiTrimSetupReadySubtitleRestaurantName(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a setup.ready.subtitle restaurant name under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeSetupReadySubtitleRestaurantName(
  value: string
): string | null {
  const trimmed = asciiTrimSetupReadySubtitleRestaurantName(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for setup.ready.subtitle `readyName` display. Preserves soft
 * empty → null (intentional localized `setup.ready.subtitle.none` copy) while
 * refusing to invent a clean restaurant name via Unicode em-space / NBSP
 * trim. Does not throw; Unicode-padded / unsafe / non-string tokens return
 * null so the live `setup.ready.subtitle.none` branch owns the fallback
 * without inventing a clean setup-ready restaurant identity from padding,
 * and without letting non-nullish Unicode-only space or empty string bypass
 * that fallback through the prior always-pass readyName interpolate.
 */
export function normalizeSetupReadySubtitleRestaurantName(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still interpolated into setup.ready.subtitle as a
  // blank-looking restaurant identity when readyName was truthy.
  // Do not invent a clean setup.ready.subtitle restaurant label from padding.
  if (!value.trim()) return null;
  return canonicalizeSetupReadySubtitleRestaurantName(value);
}
