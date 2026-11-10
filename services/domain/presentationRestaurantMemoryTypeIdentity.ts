/**
 * Restaurant Memory hub memoryType presentation (MISE-005ABT).
 *
 * Restaurant Memory previously always interpolated raw `memory.memoryType`
 * into the card type line with only underscore→space humanize and no prep
 * gate: `{memory.memoryType.replace(/_/g, " ")}`. Operators saw English
 * machine tokens such as `demand_pattern` / `supplier_reliability` instead
 * of localized copy. Separately, a Unicode-only-space memory type is truthy
 * so blank-looking type chrome could render, and Unicode `.trim()` on padded
 * tokens would invent a clean memory-type code before humanize.
 *
 * This helper:
 * 1. Soft-nulls empty / Unicode-padded / control-bearing tokens under ASCII C
 *    single-line prep (end trim only; preserve NBSP; full C0/DEL reject).
 * 2. Allows only the deterministic snake_case RestaurantMemoryType vocabulary.
 * 3. Maps allowlisted tokens to localized MessageKey copy; unknown or unsafe
 *    non-empty tokens fall through to `memory.typeCode.unknown` rather than
 *    inventing raw-token / underscore-humanized display.
 *
 * Null / undefined / empty string also resolve to localized unknown so the
 * type line never falls back to inventing machine humanize. Not Restaurant
 * Memory statement (#830), correction draft (#848), evidence.summary (#1154),
 * subtitle restaurant.name (#1042), scope/source (#841), domain
 * convertMemoryToRule title humanize (leave alone), memory.status display
 * (deferred), Autonomy actionType leave-alone, or Activity evidence.type
 * (#1225).
 */

import type { MessageKey } from "../../i18n/catalog";

const TYPE_MESSAGE_KEYS = {
  demand_pattern: "memory.typeCode.demand_pattern",
  prep_habit: "memory.typeCode.prep_habit",
  waste_pattern: "memory.typeCode.waste_pattern",
  supplier_reliability: "memory.typeCode.supplier_reliability",
  staff_timing: "memory.typeCode.staff_timing",
  safety_stock_preference: "memory.typeCode.safety_stock_preference",
  service_window: "memory.typeCode.service_window",
  approval_preference: "memory.typeCode.approval_preference",
  seasonal_effect: "memory.typeCode.seasonal_effect",
  weather_effect: "memory.typeCode.weather_effect",
  local_event_effect: "memory.typeCode.local_event_effect",
  menu_dependency: "memory.typeCode.menu_dependency",
  operational_exception: "memory.typeCode.operational_exception",
  rejected_recommendation: "memory.typeCode.rejected_recommendation",
  edited_quantity: "memory.typeCode.edited_quantity",
  recurring_bottleneck: "memory.typeCode.recurring_bottleneck",
  action_outcome: "memory.typeCode.action_outcome"
} as const satisfies Record<string, MessageKey>;

export type RestaurantMemoryTypeCode = keyof typeof TYPE_MESSAGE_KEYS;

const ALLOWED_TYPE = new RegExp(`^(?:${Object.keys(TYPE_MESSAGE_KEYS).join("|")})$`);

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized memory type token before localization.
 */
export function asciiTrimRestaurantMemoryType(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Restaurant Memory memoryType under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, containing
 * ASCII controls, or outside the allowlisted snake_case vocabulary.
 */
export function canonicalizeRestaurantMemoryType(
  value: string
): RestaurantMemoryTypeCode | null {
  const trimmed = asciiTrimRestaurantMemoryType(value);
  if (!trimmed) return null;
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  if (!ALLOWED_TYPE.test(trimmed)) return null;
  return trimmed as RestaurantMemoryTypeCode;
}

/**
 * Soft normalize for Restaurant Memory memoryType tokens.
 * Soft empty / Unicode-only space → null. Does not throw.
 */
export function normalizeRestaurantMemoryType(
  value: string | null | undefined
): RestaurantMemoryTypeCode | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  if (!value.trim()) return null;
  return canonicalizeRestaurantMemoryType(value);
}

/**
 * Resolve the MessageKey for Restaurant Memory card type chrome.
 *
 * - allowlisted token → localized typeCode key
 * - empty / null / undefined / unsafe / unknown → unknown localized copy
 *   (never raw underscore-humanized machine tokens)
 */
export function resolveRestaurantMemoryTypeMessageKey(
  value: string | null | undefined
): MessageKey {
  if (value === null || value === undefined || value === "") {
    return "memory.typeCode.unknown";
  }
  if (typeof value !== "string") {
    return "memory.typeCode.unknown";
  }
  if (!value.trim()) return "memory.typeCode.unknown";
  const token = canonicalizeRestaurantMemoryType(value);
  if (!token) return "memory.typeCode.unknown";
  return TYPE_MESSAGE_KEYS[token];
}
