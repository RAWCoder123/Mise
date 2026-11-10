/**
 * Restaurant Memory `convertMemoryToRule` title identity helpers (MISE-005ABX).
 *
 * Pins the domain rule-draft path in `convertMemoryToRule` that previously
 * always-passed raw `memory.memoryType` into the operator-facing draft title
 * with only underscore→space humanize and no prep gate:
 *
 * ```text
 * title: memory.memoryType.replace(/_/g, " ")
 * ```
 *
 * A Unicode-only-space memory type (`"\u2003"`) is a non-empty string, so the
 * draft still carried blank-looking title identity (`" "`). Separately,
 * Unicode `.trim()` on a padded type
 * (`"\u2003demand_pattern\u2003".trim() === "demand_pattern"`) would invent a
 * clean display title if that gate Unicode-trimmed before interpolating into
 * the draft title (and before underscore→space humanize).
 *
 * Single-line rule-title tips use ASCII end trim only and preserve NBSP (no
 * fold into plain space). Soft-null when Unicode trim would still strip end
 * padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded type. Accents and case are preserved. Full C0/DEL control
 * rejection applies (no LF/TAB/CR allowlist). Only the deterministic
 * `RestaurantMemoryType` snake_case vocabulary is allowed through; unknown
 * tokens soft-null rather than inventing underscore-humanized display from
 * arbitrary machine strings.
 *
 * These are domain **convertMemoryToRule title** tokens only — the draft
 * `title` that soft-nulls back to the intentional `"unknown"` fallthrough
 * when unsafe. Not Restaurant Memory hub `memory.memoryType` localization
 * (#1230 / MISE-005ABT), not hub `memory.status` localization
 * (#1231 / MISE-005ABU), not statement (#830), correction draft (#848),
 * evidence.summary (#1154), subtitle restaurant.name (#1042), scope/source
 * (#841), Autonomy actionType / evidence.type leave-alone, or Activity
 * recalculation cycle humanize (#1233 / MISE-005ABW). Soft empty /
 * Unicode-padded / control-bearing / unknown tokens soft-null so the live
 * `"unknown"` fallthrough owns the intentional blank-type fallback without
 * inventing a clean rule-draft title from padding, and without letting
 * Unicode-only space render blank-looking title identity through the prior
 * always-pass path. Ordinary ASCII whitespace still trims clean.
 * Underscore→space humanize remains a post-normalize presentation step on
 * the safe token only.
 *
 * Complements open #1230 / #1231 / #1233 without sharing those modules or
 * rewriting their call sites. Alone-OK beside #1230 (presentation/i18n of
 * hub type chrome left convertMemoryToRule title humanize alone).
 */

const ALLOWED_MEMORY_TYPES = [
  "demand_pattern",
  "prep_habit",
  "waste_pattern",
  "supplier_reliability",
  "staff_timing",
  "safety_stock_preference",
  "service_window",
  "approval_preference",
  "seasonal_effect",
  "weather_effect",
  "local_event_effect",
  "menu_dependency",
  "operational_exception",
  "rejected_recommendation",
  "edited_quantity",
  "recurring_bottleneck",
  "action_outcome"
] as const;

export type RestaurantMemoryRuleTitleType = (typeof ALLOWED_MEMORY_TYPES)[number];

const ALLOWED_TYPE = new RegExp(`^(?:${ALLOWED_MEMORY_TYPES.join("|")})$`);

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized memory-type token before it is rendered
 * into the convertMemoryToRule draft title.
 */
export function asciiTrimRestaurantMemoryRuleTitleType(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a convertMemoryToRule title memoryType under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded,
 * containing ASCII controls, or outside the allowlisted snake_case
 * vocabulary.
 */
export function canonicalizeRestaurantMemoryRuleTitleType(
  value: string
): RestaurantMemoryRuleTitleType | null {
  const trimmed = asciiTrimRestaurantMemoryRuleTitleType(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  if (!ALLOWED_TYPE.test(trimmed)) return null;
  return trimmed as RestaurantMemoryRuleTitleType;
}

/**
 * Soft normalize for `convertMemoryToRule` title memoryType tokens.
 * Preserves soft empty → null (intentional `"unknown"` fallthrough) while
 * refusing to invent a clean type via Unicode em-space / NBSP trim. Does
 * not throw; Unicode-padded / unsafe / unknown / non-string tokens return
 * null so the live `"unknown"` branch owns the fallback without inventing
 * a clean rule-draft title from padding, and without letting Unicode-only
 * space render blank-looking title identity through the prior always-pass
 * path.
 */
export function normalizeRestaurantMemoryRuleTitleType(
  value: string | null | undefined
): RestaurantMemoryRuleTitleType | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-empty padding
  // previously still rendered into the draft title as blank-looking identity.
  // Do not invent a clean convertMemoryToRule title from padding.
  if (!value.trim()) return null;
  return canonicalizeRestaurantMemoryRuleTitleType(value);
}
