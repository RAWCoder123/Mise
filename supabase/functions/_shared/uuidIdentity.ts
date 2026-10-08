/**
 * Edge UUID identity helpers (MISE-005KP).
 *
 * Pinning lives outside `mise.ts` so Node tests can import the pure helpers
 * without loading Deno `npm:` dependencies from the shared Edge runtime module.
 */

/**
 * ASCII C-locale case fold — mirrors SQL `lower(... collate "C")`.
 * Only ASCII A–Z is folded so hex A–F normalize without Unicode case mappings.
 */
export function asciiCLowerUuidToken(value: string) {
  return value.replace(/[A-Z]/g, (character) => character.toLowerCase());
}

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized UUID identity.
 */
export function asciiTrimUuidToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

const CANONICAL_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const ASCII_HEX_UUID_SHAPE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

/**
 * Canonicalize an Edge UUID identity under ASCII C.
 * Returns null when empty after ASCII trim or outside the UUID shape.
 */
export function canonicalizeEdgeUuid(value: string): string | null {
  const trimmed = asciiTrimUuidToken(value);
  if (!trimmed) return null;
  // Fail closed on anything outside ASCII hex UUID shape after ASCII trim.
  if (!ASCII_HEX_UUID_SHAPE.test(trimmed)) return null;
  const folded = asciiCLowerUuidToken(trimmed);
  if (!CANONICAL_UUID_PATTERN.test(folded)) return null;
  return folded;
}

/**
 * Fail-closed Edge UUID require used by `requireUuid` in `mise.ts`.
 * Throws plain Error so Node tests can exercise identity without Deno imports.
 */
export function requireCanonicalEdgeUuid(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} is required.`);
  }
  const trimmed = asciiTrimUuidToken(value);
  if (!trimmed) {
    throw new Error(`${fieldName} is required.`);
  }
  const text = canonicalizeEdgeUuid(value);
  if (!text) {
    throw new Error(`${fieldName} must be a valid UUID.`);
  }
  return text;
}
