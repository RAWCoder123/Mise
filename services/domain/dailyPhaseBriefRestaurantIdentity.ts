/**
 * Daily-phase-brief restaurant workspace identity helpers (MISE-005LQ).
 *
 * Pins domain- and application-layer dailyPhaseBrief restaurant_id outside the
 * full operating-plan / operating-brief / daily-report graph so Node tests can
 * exercise inventing proofs without loading sibling modules. Complements open
 * operating-brief (#746), pilot-readiness (#745), inventory (#744), restaurant
 * app (#743), setup (#742), autonomy (#741), Insights (#740), restaurant-tasks
 * (#739), Mise-actions (#738), Today (#737), operating-plan (#736), and other
 * restaurant tips without sharing their files.
 *
 * Restaurant workspace IDs are not UUID-shaped on this path (demo tenants use
 * tokens like `restaurant_a`). Only ASCII end trim is pinned; case is left
 * unchanged to preserve the existing contract.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized restaurant workspace identity.
 */
export function asciiTrimDailyPhaseBriefRestaurantToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a daily-phase-brief restaurant workspace identity under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizeDailyPhaseBriefRestaurantId(value: string): string | null {
  const trimmed = asciiTrimDailyPhaseBriefRestaurantToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 128) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed restaurant workspace require used by daily-phase-brief domain
 * entry points. Preserves the existing
 * `Daily phase briefs require a restaurant.` error contract.
 */
export function requireCanonicalDailyPhaseBriefRestaurantId(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Daily phase briefs require a restaurant.");
  }
  const text = canonicalizeDailyPhaseBriefRestaurantId(value);
  if (!text) {
    throw new Error("Daily phase briefs require a restaurant.");
  }
  return text;
}

/**
 * Fail-closed restaurant workspace require used by daily-phase-brief
 * application entry points. Preserves the existing
 * `Missing restaurant workspace.` error contract.
 */
export function requireCanonicalDailyPhaseBriefWorkspaceId(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Missing restaurant workspace.");
  }
  const text = canonicalizeDailyPhaseBriefRestaurantId(value);
  if (!text) {
    throw new Error("Missing restaurant workspace.");
  }
  return text;
}
