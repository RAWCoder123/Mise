/**
 * Purchase-authority evaluatedAt identity helpers (MISE-005UR).
 *
 * Pins domain-layer `normalizePurchaseAuthorityResult` `evaluatedAt` outside
 * the repository graph so Node tests can exercise inventing proofs without
 * loading Supabase or demo storage. Purchase-authority results previously
 * Unicode-trimmed `evaluatedAt` through shared `boundedString`
 * (`.trim().slice(0, 80)`), so NBSP/em-space padding invented a clean
 * evaluation timestamp before it was stored as durable
 * `PurchaseAuthorityResult.evaluatedAt`
 * (`'\u20032026-08-21T12:00:00.000Z\u2003'.trim() ===
 * '2026-08-21T12:00:00.000Z'`). Soft empty / Unicode-only space also
 * collapsed through Unicode trim into the intentional
 * `new Date(0).toISOString()` epoch fallback.
 *
 * These are purchase-authority **evaluation timestamps** only — not blocker
 * descriptions (#981 / MISE-005UQ), not metadata values (#819 / MISE-005OK),
 * not metadata keys (#818 / MISE-005OJ), not recipe-revision keys
 * (#807 / MISE-005NY), not countEventId (#806 / MISE-005NX), not
 * inventoryItemId (#805 / MISE-005NW), not recommendationId
 * (#804 / MISE-005NV), not supplierId (#803 / MISE-005NU), and not evidence
 * `countedAt` / `canonicalUnit` / provider-window siblings. Soft empty /
 * Unicode-padded / overlong / control-bearing tokens soft-null so padded
 * evaluation timestamps cannot invent durable `evaluatedAt` identity. Ordinary
 * ASCII whitespace still trims clean. Case and accents are left unchanged.
 * The live `|| new Date(0).toISOString()` fallback owns soft-empty and
 * fail-closed paths without inventing a clean evaluation timestamp from
 * padding.
 *
 * Complements open purchase-authority tips #981 / MISE-005UQ, #819 /
 * MISE-005OK, #818 / MISE-005OJ, #807 / MISE-005NY, #806 / MISE-005NX,
 * #805 / MISE-005NW, #804 / MISE-005NV, and #803 / MISE-005NU without sharing
 * their helper modules or rewriting those paths. Intentionally does not
 * change other `boundedString` / `nullableString` surfaces
 * (`recommendationId`, `inventoryItemId`, `supplierId`, `countEventId`,
 * `countedAt`, `canonicalUnit`, provider windows, recipe-revision keys,
 * blocker descriptions, or metadata keys/values). Those remain on their
 * existing Unicode-trim contracts in this tip.
 *
 * Max length stays 80 to match the prior `boundedString(..., 80)` cap.
 */

const MAX_PURCHASE_AUTHORITY_EVALUATED_AT = 80;

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized evaluation timestamp before it is stored
 * as durable `PurchaseAuthorityResult.evaluatedAt`.
 */
export function asciiTrimPurchaseAuthorityEvaluatedAt(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a purchase-authority evaluatedAt timestamp under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizePurchaseAuthorityEvaluatedAt(
  value: string
): string | null {
  const trimmed = asciiTrimPurchaseAuthorityEvaluatedAt(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (trimmed.length > MAX_PURCHASE_AUTHORITY_EVALUATED_AT) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for `normalizePurchaseAuthorityResult` `evaluatedAt`.
 * Preserves soft empty → null (prior `boundedString` emptiness →
 * `new Date(0).toISOString()` fallback) while refusing to invent a clean
 * evaluation timestamp via Unicode em-space trim. Does not throw;
 * Unicode-padded / unsafe / non-string tokens return null so the live
 * `|| new Date(0).toISOString()` branch owns the fail-closed fallback
 * without inventing a clean durable evaluatedAt from padding.
 */
export function normalizeCanonicalPurchaseAuthorityEvaluatedAt(
  value: unknown
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those into the intentional epoch fallback. Do not invent an
  // evaluation timestamp from padding.
  if (!value.trim()) return null;
  return canonicalizePurchaseAuthorityEvaluatedAt(value);
}
