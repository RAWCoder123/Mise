/**
 * Today screen title restaurant-name identity helpers (MISE-005UD).
 *
 * Pins `utils/screenTitles` `todayScreenTitle(restaurantName)` name prep
 * outside the Expo UI graph so Node tests can exercise inventing proofs
 * without loading React Native. Prior Today titles Unicode-trimmed the
 * restaurant name before interpolating it into chrome copy
 * (`'\u2003Luna Bistro\u2003'.trim()` → `'Luna Bistro'` →
 * `'Today at Luna Bistro'`), so NBSP/em-space padding invented a clean
 * restaurant identity in the screen title. Soft-empty / Unicode-only
 * space also collapsed through `.trim()` into the intentional
 * `"Today at Mise"` fallback.
 *
 * These are presentation **Today screen title restaurant-name tokens**
 * only — not restaurant branding initials (#967 / MISE-005UC), not
 * Settings account email labels (#966 / MISE-005UB), not Team Settings
 * directory labels (#965 / MISE-005UA), not More / Settings profile name
 * labels (#964 / MISE-005TZ), not Create Task assignee chip labels
 * (#963 / MISE-005TY), not More / Settings profile avatar initials
 * (#962 / MISE-005TX), not Home / Ask Mise greeting first-name tokens
 * (#961 / MISE-005TW), not outreach greeting `firstName` (#960 /
 * MISE-005TV), not outreach-webhook From mailbox prep (#959 /
 * MISE-005TU), and not user profile display-name persistence (#849 /
 * MISE-005PO). Soft empty / Unicode-padded / control-bearing seeds
 * soft-null so padded restaurant names cannot invent a clean Today title
 * identity; callers then keep the intentional `"Today at Mise"` fallback.
 * Ordinary ASCII whitespace still trims clean. Case and accents are left
 * unchanged. The full restaurant name (not a first-token slice) is the
 * title seed — Today chrome shows the restaurant as named.
 *
 * Complements open restaurant branding initials tip #967 / MISE-005UC
 * (which explicitly left `utils/screenTitles` Today title restaurant-name
 * prep alone) without sharing that module or rewriting branding /
 * greeting / directory / profile label paths.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized restaurant-name seed before it is
 * rendered into the Today screen title.
 */
export function asciiTrimPresentationTodayScreenTitleRestaurantName(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Today screen title restaurant-name seed under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls. Does not split on internal whitespace —
 * the full restaurant name is the title seed.
 */
export function canonicalizePresentationTodayScreenTitleRestaurantName(
  value: string
): string | null {
  const trimmed = asciiTrimPresentationTodayScreenTitleRestaurantName(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Today screen title restaurant names. Preserves soft
 * empty → null (prior `.trim()` emptiness → `"Today at Mise"` fallback)
 * while refusing to invent a clean restaurant-name seed via Unicode
 * em-space trim. Does not throw; Unicode-padded / unsafe / non-string
 * tokens return null so the live `"Today at Mise"` branch owns the
 * intentional fallback without inventing a clean title identity from
 * padding.
 */
export function normalizePresentationTodayScreenTitleRestaurantName(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those into the intentional `"Today at Mise"` fallback. Do not
  // invent a restaurant-name seed from padding.
  if (!value.trim()) return null;
  return canonicalizePresentationTodayScreenTitleRestaurantName(value);
}
