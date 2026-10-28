/**
 * Supplier-send preview expected-identity helpers (MISE-005SN).
 *
 * Pins `requireExactSupplierSendId`'s expected restaurant/order tokens so
 * Unicode `.trim()` cannot invent a successful scope match against a clean
 * payload identity via NBSP/em-space padding on the expected side.
 *
 * Intentionally does not rewrite payload `value` matching (still exact and
 * control-gated), supplier display/text/email/body parsers, content
 * fingerprints, or demo `normalizedSubject` / mailbox tips (#913 / #708).
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent equality with a clean expected identity.
 */
export function asciiTrimSupplierSendPreviewExpectedToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

/**
 * Canonicalize an expected supplier-send preview identity under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or over-long.
 * Control-character rejection stays on the payload `value` side.
 */
export function canonicalizeSupplierSendPreviewExpectedId(value: string): string | null {
  const trimmed = asciiTrimSupplierSendPreviewExpectedToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 128) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  return trimmed;
}

/**
 * Fail-closed expected-id require used by `requireExactSupplierSendId`.
 * Preserves the existing
 * `Supplier send preview returned an invalid ${label} identity.` contract when
 * the expected token cannot be canonicalized.
 */
export function requireCanonicalSupplierSendPreviewExpectedId(
  value: unknown,
  label: string
): string {
  if (typeof value !== "string") {
    throw new Error(`Supplier send preview returned an invalid ${label} identity.`);
  }
  const text = canonicalizeSupplierSendPreviewExpectedId(value);
  if (!text) {
    throw new Error(`Supplier send preview returned an invalid ${label} identity.`);
  }
  return text;
}
