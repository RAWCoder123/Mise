/**
 * Verified provider-location identity helpers (MISE-005SX).
 *
 * Pins repository-layer `fetchVerifiedProviderMappings` `providerLocationId`
 * hydrate outside `supabaseRepository` so Node tests can exercise inventing
 * proofs without loading Expo or Supabase RPCs. Prior path Unicode-trimmed
 * hosted `pos_locations.external_location_id` into durable
 * `VerifiedProviderSaleMapping.providerLocationId`
 * (`'\u2003L1ABCXYZ\u2003'.trim() === 'L1ABCXYZ'`). Soft-empty Unicode-only
 * padding also collapsed through `.trim()` into the intentional second-pass
 * filter that drops empty location identities.
 *
 * These are hosted verified-provider **location identity** tokens only — not
 * mapping-review `providerLocationId` required strings (pass-through under
 * `requiredPosMappingString`), not `sourcePos` hydrate (left on Unicode
 * `.trim()` for a separate tip), not catalog/variation/menu item IDs on the
 * same mapping row, and not domain `providerSaleIdentity.normalize` matching
 * folds. Soft empty / Unicode-padded / control-bearing tokens fail closed so
 * padded location IDs cannot invent reviewed durable POS→menu matching
 * identity. Ordinary ASCII whitespace still trims clean. Case and accents
 * are left unchanged.
 *
 * Complements open POS location SQL cntrl tip #465 / MISE-005BE without
 * sharing that migration or rewriting sibling `fetchVerifiedProviderMappings`
 * fields (`sourcePos`, catalog/variation/menu IDs). Leave
 * `providerSaleIdentity.normalize` and mapping-review parse alone.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized provider location identity before it is
 * stored on durable `VerifiedProviderSaleMapping.providerLocationId`.
 */
export function asciiTrimVerifiedProviderLocationIdToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a verified provider location id under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeVerifiedProviderLocationIdToken(
  value: string
): string | null {
  const trimmed = asciiTrimVerifiedProviderLocationIdToken(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for hosted verified-provider mapping `providerLocationId`.
 * Preserves soft empty → null (prior `.trim()` emptiness → second-pass drop)
 * while refusing to invent a clean location id via Unicode em-space trim.
 * Does not throw; Unicode-padded / unsafe / non-string tokens return null so
 * the live `row.providerLocationId` filter owns the drop.
 */
export function normalizeVerifiedProviderLocationId(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those into the second-pass filter. Do not invent a location id
  // from padding.
  if (!value.trim()) return null;
  return canonicalizeVerifiedProviderLocationIdToken(value);
}
