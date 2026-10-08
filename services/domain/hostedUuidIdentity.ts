/**
 * Hosted repository UUID identity helpers (MISE-005KV).
 *
 * Pins `requireHostedUuid` outside the repository module so Node tests can
 * exercise inventing proofs without loading the Supabase client graph.
 * Complements open Edge UUID tips (#719 / #720) without sharing their files.
 */

/**
 * ASCII C-locale case fold — mirrors SQL `lower(... collate "C")`.
 * Only ASCII A–Z is folded so hex A–F normalize without Unicode case mappings.
 */
export function asciiCLowerHostedUuidToken(value: string) {
  return value.replace(/[A-Z]/g, (character) => character.toLowerCase());
}

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized UUID identity.
 */
export function asciiTrimHostedUuidToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

/** Canonical lowercase UUID shape used by hosted repository identity. */
const CANONICAL_HOSTED_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Accept ASCII hex only (before case fold) so Kelvin / fullwidth digits fail closed. */
const ASCII_HEX_HOSTED_UUID_SHAPE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

/**
 * Canonicalize a hosted UUID identity under ASCII C.
 * Returns null when empty after ASCII trim or outside the UUID shape.
 */
export function canonicalizeHostedUuid(value: string): string | null {
  const trimmed = asciiTrimHostedUuidToken(value);
  if (!trimmed) return null;
  if (!ASCII_HEX_HOSTED_UUID_SHAPE.test(trimmed)) return null;
  const folded = asciiCLowerHostedUuidToken(trimmed);
  if (!CANONICAL_HOSTED_UUID_PATTERN.test(folded)) return null;
  return folded;
}

/**
 * Fail-closed hosted UUID require used by `requireHostedUuid`.
 * Preserves the existing `Invalid ${label} identity.` error contract.
 */
export function requireCanonicalHostedUuid(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`Invalid ${label} identity.`);
  }
  const text = canonicalizeHostedUuid(value);
  if (!text) {
    throw new Error(`Invalid ${label} identity.`);
  }
  return text;
}
