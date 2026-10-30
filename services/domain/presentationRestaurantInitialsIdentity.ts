/**
 * Restaurant branding presentation initials identity helpers (MISE-005UC).
 *
 * Pins `utils/restaurantBranding` `restaurantInitials(restaurant)` name prep
 * outside the Expo UI graph so Node tests can exercise inventing proofs
 * without loading React Native. Prior restaurant-avatar helpers
 * Unicode-trimmed `restaurant?.name` before splitting on whitespace and
 * taking the first character of up to two tokens
 * (`'\u2003Luna Bistro\u2003'.trim().split(/\s+/).slice(0, 2)` →
 * `['Luna','Bistro']` → `'LB'`), so NBSP/em-space padding invented clean
 * restaurant initials. Soft empty / Unicode-only space also collapsed
 * through `.trim()` into the intentional `"M"` empty-restaurant fallback.
 *
 * These are presentation **restaurant branding initials** only — not More /
 * Settings profile avatar initials (#962 / MISE-005TX), not More / Settings
 * profile name labels (#964 / MISE-005TZ), not Settings account email labels
 * (#966 / MISE-005UB), not Team Settings directory labels (#965 / MISE-005UA),
 * not Create Task assignee chip labels (#963 / MISE-005TY), not Home / Ask
 * Mise greeting first-name tokens (#961 / MISE-005TW), not outreach greeting
 * `firstName` (#960 / MISE-005TV), not outreach-webhook From mailbox prep
 * (#959 / MISE-005TU), not user profile display-name persistence (#849 /
 * MISE-005PO), and not `utils/screenTitles` Today screen title restaurant-name
 * prep. Soft empty / Unicode-padded / control-bearing seeds soft-null so
 * padded restaurant names cannot invent clean initials; callers then keep
 * the intentional `"M"` empty-restaurant fallback. Ordinary ASCII whitespace
 * still trims clean. Case folding for the rendered initials remains
 * caller-owned (`toUpperCase`). Selection stays restaurant-branding
 * semantics: first character of up to two whitespace-separated tokens
 * (single-token `"Chef"` → `"C"`, not profile-avatar two-letter slice).
 *
 * Complements open More/Settings profile initials tip #962 / MISE-005TX
 * (which explicitly left `utils/restaurantBranding` restaurant initials
 * alone) without sharing that module or rewriting profile / greeting /
 * directory / screen-title paths.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized restaurant-name seed before branding
 * initials are derived.
 */
export function asciiTrimPresentationRestaurantInitialsSeed(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a restaurant branding initials seed under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls. Does not derive initials — callers split
 * after successful canonicalize.
 */
export function canonicalizePresentationRestaurantInitialsSeed(
  value: string
): string | null {
  const trimmed = asciiTrimPresentationRestaurantInitialsSeed(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for restaurant branding initials seeds. Preserves soft
 * empty → null (prior `.trim()` emptiness → `"M"` fallback) while refusing
 * to invent a clean restaurant-name seed via Unicode em-space trim. Does
 * not throw; Unicode-padded / unsafe / non-string tokens return null so the
 * live empty-restaurant `"M"` branch owns the intentional fallback without
 * inventing clean initials from padding.
 */
export function normalizePresentationRestaurantInitialsSeed(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those into the intentional `"M"` restaurant fallback. Do not
  // invent a seed from padding.
  if (!value.trim()) return null;
  return canonicalizePresentationRestaurantInitialsSeed(value);
}

/**
 * Derive restaurant branding initials under ASCII C. Soft-null / empty
 * seeds keep the intentional `"M"` fallback. Takes the first character of
 * up to two whitespace-separated tokens (matches prior
 * `restaurantInitials` selection; single-token `"Chef"` → `"C"`).
 */
export function presentationRestaurantInitialsFromSeed(
  value: string | null | undefined
): string {
  const canonical = normalizePresentationRestaurantInitialsSeed(value);
  if (!canonical) return "M";
  return canonical
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
