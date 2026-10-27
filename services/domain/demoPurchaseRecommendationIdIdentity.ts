/**
 * Demo purchase-recommendation id helpers (MISE-005SC).
 *
 * Pins `services/demo/replaceableDemoData.ts` `repairDemoState` recommendation
 * id prep outside Expo/AsyncStorage so Node tests can exercise inventing
 * proofs. The prior path fed `recommendation.id?.trim()` into durable demo
 * `purchaseRecommendations[].id` values (and collision suffixes), so NBSP /
 * em-space padding invented a clean recommendation identity
 * (`'\u2003rec_abc\u2003'.trim() === 'rec_abc'`). Soft empty / Unicode-only
 * space also invented the legacy-id branch via `'\u2003'.trim() === ''` falling
 * through to `` `rec_legacy_${index + 1}` ``.
 *
 * These are replaceable-demo **purchase recommendation id** tokens only — not
 * restaurant-tasks `relatedRecommendationId` (open #814 / MISE-005OF), not
 * replaceableDemo setup/lookup keys (open #686 / MISE-005JQ), not Orders
 * recommendation quantity drafts (open #889 / MISE-005RC), and not hosted
 * purchase-recommendation identity. Soft empty (missing, `""`, ASCII
 * whitespace, or Unicode-only space) stays null so callers keep the prior
 * `` `rec_legacy_${index + 1}` `` migration contract. Ordinary ASCII
 * whitespace still trims clean before durable id. Unicode-padded or
 * control-bearing tokens fail closed so padded `"rec_abc"` cannot invent a
 * reviewed durable recommendation id.
 *
 * Complements open relatedRecommendationId tip #814 / MISE-005OF and setup
 * lookup tip #686 / MISE-005JQ without sharing those modules. Leave
 * `normalizeSetupList`, recipe-baseline parse, and supplier display-name
 * alone until their own tips own those paths.
 */

const DEMO_PURCHASE_RECOMMENDATION_ID_MAX_CHARACTERS = 200;

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized demo purchase-recommendation id before
 * durable purchaseRecommendations identity and collision suffixes.
 */
export function asciiTrimDemoPurchaseRecommendationId(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a demo purchase-recommendation id under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizeDemoPurchaseRecommendationId(
  value: string
): string | null {
  const trimmed = asciiTrimDemoPurchaseRecommendationId(value);
  if (!trimmed) return null;
  if (trimmed.length > DEMO_PURCHASE_RECOMMENDATION_ID_MAX_CHARACTERS) {
    return null;
  }
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed normalize for demo purchase-recommendation id repair.
 * Preserves soft empty → null (prior `recommendation.id?.trim()` empty path
 * that falls through to `` `rec_legacy_${index + 1}` ``) while refusing
 * Unicode-padded tokens that would invent a durable recommendation identity.
 * Null/undefined/"" remain null. Error contract:
 * `Purchase recommendation id is invalid.`
 */
export function normalizeCanonicalDemoPurchaseRecommendationId(
  value: unknown
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    throw new Error("Purchase recommendation id is invalid.");
  }
  const canonical = canonicalizeDemoPurchaseRecommendationId(value);
  if (canonical) return canonical;
  // Preserve soft empty (ASCII whitespace or Unicode-only space) → null.
  if (!value.trim()) return null;
  throw new Error("Purchase recommendation id is invalid.");
}

export { DEMO_PURCHASE_RECOMMENDATION_ID_MAX_CHARACTERS };
