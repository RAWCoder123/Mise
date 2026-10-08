/**
 * Outreach-agent string identity helpers (MISE-005KU).
 *
 * Pinning lives outside `outreach-agent/index.ts` so Node tests can import the
 * pure helpers without loading Deno `npm:` dependencies from the Edge function.
 *
 * Complements MISE-005KT (shared Edge `requireString` in `mise.ts` /
 * `stringIdentity.ts`) and MISE-005KQ (outreach `requireUuid`) without
 * retargeting those paths, Edge `isCanonicalEmail`, or #706 secret scrubbers.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized outreach string identity (actions,
 * campaign fields, header lines, mailbox inputs routed through local
 * `requireString`).
 */
export function asciiTrimOutreachString(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

/**
 * Fail-closed outreach required-string used by the local `requireString`
 * in `outreach-agent/index.ts`. Throws plain Error so Node tests can
 * exercise identity without Deno imports. Preserves the existing
 * length-bounded error contract.
 */
export function requireCanonicalOutreachString(
  value: unknown,
  fieldName: string,
  maximumLength: number
): string {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} is required.`);
  }
  const text = asciiTrimOutreachString(value);
  if (!text || text.length > maximumLength) {
    throw new Error(`${fieldName} must contain 1-${maximumLength} characters.`);
  }
  return text;
}
