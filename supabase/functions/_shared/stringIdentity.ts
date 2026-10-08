/**
 * Edge string identity helpers (MISE-005KT).
 *
 * Pinning lives outside `mise.ts` so Node tests can import the pure helpers
 * without loading Deno `npm:` dependencies from the shared Edge runtime module.
 *
 * Complements MISE-005KP (`uuidIdentity.ts` / Edge `requireUuid`) without
 * retargeting UUID canonicalization, outreach-agent's local `requireString`,
 * Edge `isCanonicalEmail`, or secret scrubbers.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized string identity (enum actions, ISO
 * date bounds, destructive confirmations, and related Edge inputs).
 */
export function asciiTrimEdgeString(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

/**
 * Fail-closed Edge required-string used by `requireString` in `mise.ts`.
 * Throws plain Error so Node tests can exercise identity without Deno imports.
 */
export function requireCanonicalEdgeString(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} is required.`);
  }
  const trimmed = asciiTrimEdgeString(value);
  if (!trimmed) {
    throw new Error(`${fieldName} is required.`);
  }
  return trimmed;
}

/**
 * Fail-closed Edge enum identity used by `requireEnum` in `mise.ts`.
 */
export function requireCanonicalEdgeEnum<TValue extends string>(
  value: unknown,
  fieldName: string,
  allowedValues: readonly TValue[]
): TValue {
  const text = requireCanonicalEdgeString(value, fieldName);
  if (!allowedValues.includes(text as TValue)) {
    throw new Error(`${fieldName} is not supported.`);
  }
  return text as TValue;
}

/**
 * Fail-closed Edge ISO date identity used by `requireIsoDateString` in `mise.ts`.
 */
export function requireCanonicalEdgeIsoDateString(value: unknown, fieldName: string): string {
  const text = requireCanonicalEdgeString(value, fieldName);
  const timestamp = Date.parse(text);
  if (!Number.isFinite(timestamp)) {
    throw new Error(`${fieldName} must be a valid ISO date string.`);
  }
  return text;
}
