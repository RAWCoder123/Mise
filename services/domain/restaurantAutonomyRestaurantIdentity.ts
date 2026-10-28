/**
 * Restaurant-autonomy domain restaurant workspace identity helpers (MISE-005SG).
 *
 * Pins `autonomyRuleFromPersistedRow` restaurant_id hydrate outside the
 * autonomy application / repository graph so Node tests can exercise inventing
 * proofs without loading Expo or Supabase. The prior path fed Unicode
 * `.trim()` into durable `RestaurantAutonomyRule.restaurantId`, so NBSP /
 * em-space padding invented a clean workspace identity
 * (`'\u2003restaurant_a\u2003'.trim() === 'restaurant_a'`) before
 * tenant-scope checks on listed/saved autonomy rules.
 *
 * These are restaurant-autonomy **persisted-row hydrate** workspace tokens
 * only — not autonomy application entry points (open #741 / MISE-005LK), not
 * spend-limit drafts (#888 / MISE-005RB), not allowed-window times (#878 /
 * MISE-005QR), not communicationType (#877 / MISE-005QQ), and not sibling
 * restaurant-memory / Mise-actions / waste-analysis restaurant workspace tips.
 * Soft empty / Unicode-padded / control-bearing tokens fail closed so padded
 * workspace values cannot invent reviewed durable autonomy restaurant
 * identity. Ordinary ASCII whitespace still trims clean. Case is left
 * unchanged; demo tenants use non-UUID tokens like `restaurant_a`.
 *
 * Complements open autonomy application tip #741 / MISE-005LK without sharing
 * that module or re-tipping application `fetchAutonomyRules` /
 * `saveAutonomyRule` / `createSafeDefaultAutonomyRules`. Leave
 * `defaultAutonomyRules` restaurantId pass-through alone (application tip
 * already gates that entry).
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized restaurant workspace identity before
 * autonomy rule tenant scope.
 */
export function asciiTrimRestaurantAutonomyRestaurantToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a restaurant-autonomy restaurant workspace identity under
 * ASCII C. Returns null when empty after ASCII trim, still Unicode-padded,
 * over-long, or containing ASCII controls.
 */
export function canonicalizeRestaurantAutonomyRestaurantId(
  value: string
): string | null {
  const trimmed = asciiTrimRestaurantAutonomyRestaurantToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 128) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed restaurant workspace require used by domain
 * `autonomyRuleFromPersistedRow`. Unicode-padded / empty / control-bearing
 * tokens cannot invent a durable autonomy restaurant identity.
 */
export function requireCanonicalRestaurantAutonomyRestaurantId(
  value: unknown
): string {
  if (typeof value !== "string") {
    throw new Error("Restaurant autonomy requires a restaurant id.");
  }
  const text = canonicalizeRestaurantAutonomyRestaurantId(value);
  if (!text) {
    throw new Error("Restaurant autonomy requires a restaurant id.");
  }
  return text;
}
