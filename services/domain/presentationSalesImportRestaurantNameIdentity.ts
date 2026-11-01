/**
 * Sales-import hero restaurant-name identity helpers (MISE-005VN).
 *
 * Pins Sales Import OperationalHero meta selection that previously used
 * nullish coalescing before the intentional localized fallback:
 * `restaurant?.name ?? t("common.notSet")`.
 *
 * A Unicode-only-space restaurant name (`"\u2003"`) is non-nullish
 * (`("\u2003" ?? FALLBACK) === "\u2003"`), so the intentional
 * `common.notSet` copy was bypassed and the Sales Import hero could render
 * a blank-looking restaurant meta line. Empty string has the same `??`
 * bypass (`("" ?? FALLBACK) === ""`). Separately, Unicode `.trim()` on a
 * padded restaurant name
 * (`"\u2003Luna Bistro\u2003".trim() === "Luna Bistro"`) would invent a
 * clean display restaurant identity if that gate Unicode-trimmed before
 * rendering into the Sales Import hero meta.
 *
 * Single-line restaurant-name tips use ASCII end trim only and preserve
 * NBSP (no fold into plain space). Soft-null when Unicode trim would still
 * strip end padding (NBSP / em-space) so padding cannot invent equality
 * with an unpadded restaurant name. Accents and case are preserved. Full
 * C0/DEL control rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **common.notSet** restaurant-name tokens only —
 * the Sales Import hero meta that falls through to that fallback. Not
 * Settings hub restaurant-name (#1021 / MISE-005VM), not Insights analytics
 * profile restaurant-name (#969 / MISE-005UE), not Today screen title
 * restaurant-name (#968 / MISE-005UD), not restaurant branding initials
 * (#967 / MISE-005UC), not Settings account email (#966 / MISE-005UB), not
 * Team Settings directory labels (#965 / MISE-005UA), not More / Settings
 * profile name labels (#964 / MISE-005TZ), not durable
 * `requireRestaurantName` / demo restaurant-name writers (#844 /
 * MISE-005PJ), not Settings workspace switcher `item.name` /
 * `cuisine_type ?? metaFallback`, not Orders gmail connected-body sender
 * (#1020), not Settings/Gmail sender_email (#1019), and not Home
 * ApprovalsSection card titles. Soft empty / Unicode-padded /
 * control-bearing tokens soft-null so the live `|| t("common.notSet")`
 * branch owns the intentional localized fallback. Ordinary ASCII
 * whitespace still trims clean.
 *
 * Complements open #1021 / #969 / #968 / #967 / #966 / #965 / #964 / #844
 * on other restaurant-name or Settings presentation tips without sharing
 * those modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Sales Import restaurant name before it
 * is rendered into the Sales Import OperationalHero meta.
 */
export function asciiTrimSalesImportRestaurantName(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Sales Import restaurant name under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeSalesImportRestaurantName(
  value: string
): string | null {
  const trimmed = asciiTrimSalesImportRestaurantName(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Sales Import hero `restaurant.name` display.
 * Preserves soft empty → null (intentional localized common.notSet copy)
 * while refusing to invent a clean restaurant name via Unicode em-space /
 * NBSP trim. Does not throw; Unicode-padded / unsafe / non-string tokens
 * return null so the live `|| t("common.notSet")` branch owns the
 * fallback without inventing a clean Sales Import restaurant meta from
 * padding, and without letting non-nullish Unicode-only space or empty
 * string bypass that fallback through the prior `??` row.
 */
export function normalizeSalesImportRestaurantName(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously bypassed the intentional localized notSet copy via `??`.
  // Do not invent a clean Sales Import restaurant label from padding.
  if (!value.trim()) return null;
  return canonicalizeSalesImportRestaurantName(value);
}
