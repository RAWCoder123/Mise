/**
 * Insights sales-analytics domain restaurant workspace identity helpers
 * (MISE-005MY).
 *
 * Pins domain-layer `buildInsightsSalesAnalytics` restaurantId outside the
 * Insights application graph so Node tests can exercise inventing proofs
 * without loading Supabase or demo storage. Complements open Insights
 * application restaurant tip #740 (`Missing restaurant workspace.` /
 * `requireCanonicalInsightsWorkspaceId`) and open salesTrends restaurant tip
 * #775 (`Sales trend requires a restaurant.`) without sharing those helper
 * modules or rewriting application Insights entry points. Leaves sibling
 * domain restaurant workspace trims on `supplierReliability`,
 * `orderAutomation`, and other domain modules for their own tips.
 *
 * Restaurant workspace IDs are not UUID-shaped on this path (demo tenants use
 * tokens like `restaurant_a`). Only ASCII end trim is pinned; case is left
 * unchanged to preserve the existing exact-match contract against
 * `sale.restaurant_id` values.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized restaurant workspace identity before
 * POS sales are tenant-scoped.
 */
export function asciiTrimInsightsSalesAnalyticsRestaurantToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an insights sales-analytics restaurant workspace identity under
 * ASCII C. Returns null when empty after ASCII trim, still Unicode-padded,
 * over-long, or containing ASCII controls.
 */
export function canonicalizeInsightsSalesAnalyticsRestaurantId(value: string): string | null {
  const trimmed = asciiTrimInsightsSalesAnalyticsRestaurantToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 128) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed restaurant workspace require used by domain
 * `buildInsightsSalesAnalytics`.
 * Preserves a distinct message from Insights application tip #740 and
 * salesTrends tip #775: `Sales analytics requires a restaurant workspace.`
 */
export function requireCanonicalInsightsSalesAnalyticsWorkspaceId(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Sales analytics requires a restaurant workspace.");
  }
  const text = canonicalizeInsightsSalesAnalyticsRestaurantId(value);
  if (!text) {
    throw new Error("Sales analytics requires a restaurant workspace.");
  }
  return text;
}
