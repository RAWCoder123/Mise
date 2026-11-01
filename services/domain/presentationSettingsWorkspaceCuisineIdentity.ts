/**
 * Settings workspace cuisine_type identity helpers (MISE-005VO).
 *
 * Pins Settings workspace switcher meta selection that previously used
 * nullish coalescing before the intentional localized fallback:
 * `item.cuisine_type ?? t("settings.workspace.metaFallback")`.
 *
 * A Unicode-only-space cuisine type (`"\u2003"`) is non-nullish
 * (`("\u2003" ?? FALLBACK) === "\u2003"`), so the intentional
 * `settings.workspace.metaFallback` copy was bypassed and the workspace
 * row could render a blank-looking cuisine meta line. Empty string has
 * the same `??` bypass (`("" ?? FALLBACK) === ""`). Separately, Unicode
 * `.trim()` on a padded cuisine type
 * (`"\u2003Coastal Seafood\u2003".trim() === "Coastal Seafood"`) would
 * invent a clean display cuisine identity if that gate Unicode-trimmed
 * before rendering into the Settings workspace meta.
 *
 * Single-line cuisine tips use ASCII end trim only and preserve NBSP (no
 * fold into plain space). Soft-null when Unicode trim would still strip
 * end padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded cuisine type. Accents and case are preserved. Full C0/DEL
 * control rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **settings.workspace.metaFallback** cuisine
 * tokens only — the Settings workspace switcher meta that falls through
 * to that fallback. Not Settings workspace switcher `item.name`, not
 * Settings hub restaurant-name (#1021 / MISE-005VM), not Sales Import
 * hero restaurant-name (#1022 / MISE-005VN), not Insights analytics
 * profile restaurant-name / cuisineFallback (#969 / MISE-005UE), not
 * Today screen title restaurant-name (#968 / MISE-005UD), not restaurant
 * branding initials / hard-coded English cuisine (#967 / MISE-005UC), not
 * Settings account email (#966 / MISE-005UB), not Team Settings directory
 * labels (#965 / MISE-005UA), not More / Settings profile name labels
 * (#964 / MISE-005TZ), not durable `requireRestaurantName` (#844 /
 * MISE-005PJ), not Orders gmail connected-body sender (#1020), not
 * Settings/Gmail sender_email (#1019), not POS mappings
 * suggestedMenuItemName / selectedMenuItem.name, and not Home
 * ApprovalsSection card titles. Soft empty / Unicode-padded /
 * control-bearing tokens soft-null so the live
 * `|| t("settings.workspace.metaFallback")` branch owns the intentional
 * localized fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1022 / #1021 / #1020 / #1019 / #969 / #968 / #967 /
 * #966 / #965 / #964 / #844 on other presentation tips without sharing
 * those modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Settings workspace cuisine before it is
 * rendered into the Settings workspace meta line.
 */
export function asciiTrimSettingsWorkspaceCuisine(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Settings workspace cuisine_type under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeSettingsWorkspaceCuisine(
  value: string
): string | null {
  const trimmed = asciiTrimSettingsWorkspaceCuisine(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Settings workspace `item.cuisine_type` display.
 * Preserves soft empty → null (intentional localized metaFallback copy)
 * while refusing to invent a clean cuisine type via Unicode em-space /
 * NBSP trim. Does not throw; Unicode-padded / unsafe / non-string tokens
 * return null so the live `|| t("settings.workspace.metaFallback")`
 * branch owns the fallback without inventing a clean workspace cuisine
 * from padding, and without letting non-nullish Unicode-only space or
 * empty string bypass that fallback through the prior `??` row.
 */
export function normalizeSettingsWorkspaceCuisine(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously bypassed the intentional localized metaFallback copy via `??`.
  // Do not invent a clean Settings workspace cuisine label from padding.
  if (!value.trim()) return null;
  return canonicalizeSettingsWorkspaceCuisine(value);
}
