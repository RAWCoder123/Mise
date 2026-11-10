/**
 * Restaurant Memory hub memory.status presentation (MISE-005ABU).
 *
 * Restaurant Memory previously always interpolated raw `memory.status` into
 * the card meta line with no prep gate and no localization:
 * `{memory.status}`. Operators saw English machine tokens such as `active` /
 * `confirmed` / `forgotten` instead of localized copy. Separately, a
 * Unicode-only-space memory status is truthy so blank-looking status chrome
 * could render between confidence and updated date, and Unicode `.trim()` on
 * padded tokens would invent a clean status code before display.
 *
 * This helper:
 * 1. Soft-nulls empty / Unicode-padded / control-bearing tokens under ASCII C
 *    single-line prep (end trim only; preserve NBSP; full C0/DEL reject).
 * 2. Allows only the deterministic RestaurantMemoryStatus vocabulary.
 * 3. Maps allowlisted tokens to localized MessageKey copy; unknown or unsafe
 *    non-empty tokens fall through to `memory.statusCode.unknown` rather than
 *    inventing raw-token display.
 *
 * Null / undefined / empty string also resolve to localized unknown so the
 * status segment never falls back to inventing machine tokens. Not Restaurant
 * Memory memoryType (#1230 / MISE-005ABT), statement (#830), correction draft
 * (#848), evidence.summary (#1154), subtitle restaurant.name (#1042),
 * scope/source (#841), domain convertMemoryToRule title humanize (leave
 * alone), Autonomy actionType leave-alone, or Activity evidence.type (#1225).
 */

import type { MessageKey } from "../../i18n/catalog";

const STATUS_MESSAGE_KEYS = {
  active: "memory.statusCode.active",
  confirmed: "memory.statusCode.confirmed",
  corrected: "memory.statusCode.corrected",
  dismissed: "memory.statusCode.dismissed",
  forgotten: "memory.statusCode.forgotten",
  disabled: "memory.statusCode.disabled"
} as const satisfies Record<string, MessageKey>;

export type RestaurantMemoryStatusCode = keyof typeof STATUS_MESSAGE_KEYS;

const ALLOWED_STATUS = new RegExp(`^(?:${Object.keys(STATUS_MESSAGE_KEYS).join("|")})$`);

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized memory status token before localization.
 */
export function asciiTrimRestaurantMemoryStatus(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Restaurant Memory memory.status under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, containing
 * ASCII controls, or outside the allowlisted status vocabulary.
 */
export function canonicalizeRestaurantMemoryStatus(
  value: string
): RestaurantMemoryStatusCode | null {
  const trimmed = asciiTrimRestaurantMemoryStatus(value);
  if (!trimmed) return null;
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  if (!ALLOWED_STATUS.test(trimmed)) return null;
  return trimmed as RestaurantMemoryStatusCode;
}

/**
 * Soft normalize for Restaurant Memory memory.status tokens.
 * Soft empty / Unicode-only space → null. Does not throw.
 */
export function normalizeRestaurantMemoryStatus(
  value: string | null | undefined
): RestaurantMemoryStatusCode | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  if (!value.trim()) return null;
  return canonicalizeRestaurantMemoryStatus(value);
}

/**
 * Resolve the MessageKey for Restaurant Memory card status chrome.
 *
 * - allowlisted token → localized statusCode key
 * - empty / null / undefined / unsafe / unknown → unknown localized copy
 *   (never raw machine status tokens)
 */
export function resolveRestaurantMemoryStatusMessageKey(
  value: string | null | undefined
): MessageKey {
  if (value === null || value === undefined || value === "") {
    return "memory.statusCode.unknown";
  }
  if (typeof value !== "string") {
    return "memory.statusCode.unknown";
  }
  if (!value.trim()) return "memory.statusCode.unknown";
  const token = canonicalizeRestaurantMemoryStatus(value);
  if (!token) return "memory.statusCode.unknown";
  return STATUS_MESSAGE_KEYS[token];
}
