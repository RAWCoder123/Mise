/**
 * Insights hub subtitle cuisine_type identity helpers (MISE-005VU).
 *
 * Pins the Insights screen subtitle style selection that previously used
 * nullish coalescing before the intentional localized fallback:
 * `serviceLabel ?? restaurant.cuisine_type ?? t("settings.profile.cuisineFallback")`.
 *
 * A Unicode-only-space cuisine type (`"\u2003"`) is non-nullish
 * (`("\u2003" ?? FALLBACK) === "\u2003"`), so when `serviceLabel` is null the
 * intentional `settings.profile.cuisineFallback` copy was bypassed and the
 * Insights subtitle could interpolate a blank-looking cuisine style.
 * Empty string has the same `??` bypass (`("" ?? FALLBACK) === ""`).
 * Separately, Unicode `.trim()` on a padded cuisine type
 * (`"\u2003Coastal Seafood\u2003".trim() === "Coastal Seafood"`) would
 * invent a clean display cuisine identity if that gate Unicode-trimmed
 * before interpolating into `insights.subtitleRestaurantStyle`.
 *
 * Single-line cuisine tips use ASCII end trim only and preserve NBSP (no
 * fold into plain space). Soft-null when Unicode trim would still strip
 * end padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded cuisine type. Accents and case are preserved. Full C0/DEL
 * control rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **insights.subtitleRestaurantStyle** cuisine
 * tokens only — the Insights hub subtitle `style` interpolation that
 * falls through to `settings.profile.cuisineFallback`. Not Insights
 * analytics profile cuisine ProfileChip (#970 / MISE-005UF), not Insights
 * profile restaurant-name chip (#969 / MISE-005UE), not Settings workspace
 * switcher cuisine_type meta (#1023 / MISE-005VO), not Settings workspace
 * switcher `item.name`, not restaurant branding hard-coded English cuisine
 * (#967 / MISE-005UC), not miseDomain `"Cuisine not set"` evidence, and not
 * Home ApprovalsSection card titles. Soft empty / Unicode-padded /
 * control-bearing tokens soft-null so the live
 * `?? t("settings.profile.cuisineFallback")` branch owns the intentional
 * localized fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #970 / #969 / #1023 / #967 on other cuisine/name tips
 * without sharing those modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Insights subtitle cuisine before it is
 * interpolated into `insights.subtitleRestaurantStyle`.
 */
export function asciiTrimInsightsSubtitleCuisine(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an Insights subtitle cuisine_type under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeInsightsSubtitleCuisine(
  value: string
): string | null {
  const trimmed = asciiTrimInsightsSubtitleCuisine(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Insights subtitle `restaurant.cuisine_type` display.
 * Preserves soft empty → null (intentional localized cuisineFallback copy)
 * while refusing to invent a clean cuisine type via Unicode em-space /
 * NBSP trim. Does not throw; Unicode-padded / unsafe / non-string tokens
 * return null so the live `?? t("settings.profile.cuisineFallback")`
 * branch owns the fallback without inventing a clean subtitle cuisine
 * from padding, and without letting non-nullish Unicode-only space or
 * empty string bypass that fallback through the prior `??` row.
 */
export function normalizeInsightsSubtitleCuisine(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously bypassed the intentional localized cuisineFallback copy via `??`.
  // Do not invent a clean Insights subtitle cuisine label from padding.
  if (!value.trim()) return null;
  return canonicalizeInsightsSubtitleCuisine(value);
}
