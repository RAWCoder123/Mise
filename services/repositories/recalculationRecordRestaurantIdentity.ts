/**
 * Hosted recalculation-record restaurant workspace identity helpers
 * (MISE-005VB).
 *
 * Pins supabaseRepository `recordRecalculationRun` post-RPC
 * `input.restaurantId` prep outside the domain transport graph so Node tests
 * can exercise inventing proofs without loading Supabase. Prior hosted record
 * Unicode-trimmed the restaurant workspace id before tenant-scope validation
 * (`'\u2003restaurant_a\u2003'.trim() === 'restaurant_a'`), so NBSP/em-space
 * padding invented a clean workspace identity that could match a persisted
 * recalculation-run row.
 *
 * Open transport tip #734 / MISE-005LD owns `recordRecalculationRunRpcArguments`
 * workspace prep via `recalculationRunTransportRestaurantIdentity.ts` and left
 * this hosted scope-check `.trim()` call site alone. This module owns only the
 * hosted `recordRecalculationRun` scope path and preserves
 * `Recalculation run failed restaurant scope validation.` Soft empty /
 * Unicode-padded / control-bearing / over-long / non-string tokens fail
 * closed under that same hosted contract. Ordinary ASCII whitespace still
 * trims clean. Case is left unchanged (demo tenants use tokens like
 * `restaurant_a`).
 *
 * Do not share with #734 transport restaurant identity, #733 schedule,
 * #735 scheduled-recalculation, or #991 hosted restaurant-tasks create/complete.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized hosted recalculation-record restaurant
 * workspace identity before scope validation.
 */
export function asciiTrimRecalculationRecordRestaurantToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a hosted recalculation-record restaurant workspace identity
 * under ASCII C. Returns null when empty after ASCII trim, still
 * Unicode-padded, over-long, or containing ASCII controls.
 */
export function canonicalizeRecalculationRecordRestaurantId(
  value: string
): string | null {
  const trimmed = asciiTrimRecalculationRecordRestaurantToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 128) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed restaurant workspace require used by hosted
 * `recordRecalculationRun` scope prep. Preserves the existing
 * `Recalculation run failed restaurant scope validation.` error contract.
 */
export function requireCanonicalRecalculationRecordRestaurantId(
  value: unknown
): string {
  if (typeof value !== "string") {
    throw new Error("Recalculation run failed restaurant scope validation.");
  }
  const text = canonicalizeRecalculationRecordRestaurantId(value);
  if (!text) {
    throw new Error("Recalculation run failed restaurant scope validation.");
  }
  return text;
}
