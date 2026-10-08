/**
 * Client supplier-authority UUID identity helpers (MISE-005KW).
 *
 * Pins `requireSupplierAuthorityId` outside `miseValidation.ts` so Node tests
 * can exercise inventing proofs without loading the full validation graph.
 * Complements open hosted UUID tip (#725) without sharing that helper file.
 */

/**
 * ASCII C-locale case fold — mirrors SQL `lower(... collate "C")`.
 * Only ASCII A–Z is folded so hex A–F normalize without Unicode case mappings.
 */
export function asciiCLowerSupplierAuthorityUuidToken(value: string) {
  return value.replace(/[A-Z]/g, (character) => character.toLowerCase());
}

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized supplier-authority UUID identity.
 */
export function asciiTrimSupplierAuthorityUuidToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

/**
 * Canonical lowercase UUID shape used by supplier-authority identity.
 * Preserves the historical RFC variant range `[1-5]` from
 * `requireSupplierAuthorityId` (narrower than hosted `[1-8]`).
 */
const CANONICAL_SUPPLIER_AUTHORITY_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Accept ASCII hex only (before case fold) so Kelvin / fullwidth digits fail closed. */
const ASCII_HEX_SUPPLIER_AUTHORITY_UUID_SHAPE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

/**
 * Canonicalize a supplier-authority UUID identity under ASCII C.
 * Returns null when empty after ASCII trim or outside the UUID shape.
 */
export function canonicalizeSupplierAuthorityUuid(value: string): string | null {
  const trimmed = asciiTrimSupplierAuthorityUuidToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 128) return null;
  if (!ASCII_HEX_SUPPLIER_AUTHORITY_UUID_SHAPE.test(trimmed)) return null;
  const folded = asciiCLowerSupplierAuthorityUuidToken(trimmed);
  if (!CANONICAL_SUPPLIER_AUTHORITY_UUID_PATTERN.test(folded)) return null;
  return folded;
}

/**
 * Fail-closed supplier-authority UUID require used by
 * `requireSupplierAuthorityId`. Preserves the existing
 * `Missing ${label} identity.` error contract.
 */
export function requireCanonicalSupplierAuthorityUuid(
  value: unknown,
  label = "supplier"
): string {
  if (typeof value !== "string") {
    throw new Error(`Missing ${label} identity.`);
  }
  const text = canonicalizeSupplierAuthorityUuid(value);
  if (!text) {
    throw new Error(`Missing ${label} identity.`);
  }
  return text;
}
