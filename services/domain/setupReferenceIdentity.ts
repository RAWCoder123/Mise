/**
 * Setup application client-reference identity helpers (MISE-005MM).
 *
 * Pins application-layer setup.ts `requireSetupReferenceId` (supplier.id /
 * inventory supplierId client references) outside the repository graph so
 * Node tests can exercise inventing proofs without loading Supabase or demo
 * storage. Complements open setup restaurant tip #742
 * (`Missing restaurant workspace.` / `requireCanonicalSetupWorkspaceId`)
 * without sharing that helper module or rewriting the restaurant path.
 *
 * Intentionally does not change `restaurantId.trim()` on
 * `saveRestaurantSetup`. That remains on Unicode trim here and is owned by
 * #742 / MISE-005LL.
 * Intentionally does not rewrite attachment `client_reference_id` assignment
 * (`attachment.id` with no trim), supplier/item name trim, or email
 * normalization surfaces.
 *
 * Setup client references are operator draft keys such as `supplier-1`, not
 * UUID-shaped. Only ASCII end trim is pinned; case is left unchanged to
 * preserve the existing contract. Max length follows the existing
 * `requireSetupReferenceId` bound of 128.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized setup client-reference identity.
 */
export function asciiTrimSetupReferenceToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a setup client-reference identity under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizeSetupReferenceId(value: string): string | null {
  const trimmed = asciiTrimSetupReferenceToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 128) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed setup client-reference require used by
 * `requireSetupReferenceId`. Preserves the existing
 * `Setup ${label} reference is invalid.` error contract.
 */
export function requireCanonicalSetupReferenceId(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`Setup ${label} reference is invalid.`);
  }
  const text = canonicalizeSetupReferenceId(value);
  if (!text) {
    throw new Error(`Setup ${label} reference is invalid.`);
  }
  return text;
}
