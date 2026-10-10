/**
 * Order-automation domain supplier identity helpers (MISE-005MQ).
 *
 * Pins domain-layer orderAutomation.ts `supplierId` outside the repository
 * graph so Node tests can exercise inventing proofs without loading Supabase
 * or demo storage. Complements open durable supplier-authority tips without
 * sharing those helper modules or rewriting restaurant / supplier-name paths.
 *
 * Intentionally does not change `restaurantId.trim()` or `supplierName.trim()`
 * on `assessOrderAutomation`. Restaurant workspace and presentation names
 * remain on Unicode trim in this tip. Supplier display names are not authority.
 *
 * Supplier IDs are not UUID-shaped on every path (demo tokens remain valid).
 * Only ASCII end trim is pinned; case is left unchanged to preserve the
 * existing contract. Invalid identities fail closed into the existing
 * `supplier_mismatch` blocker rather than throwing from the assessment gate.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized supplier identity.
 */
export function asciiTrimOrderAutomationSupplierToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an order-automation supplier identity under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizeOrderAutomationSupplierId(value: string): string | null {
  const trimmed = asciiTrimOrderAutomationSupplierToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 128) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed supplier require for focused inventing proofs and any caller that
 * needs a thrown contract. Preserves a distinct message from restaurant /
 * deliveries / inventory object tips:
 * `Order automation requires a supplier id.`
 *
 * `assessOrderAutomation` maps a null canonicalize result to an empty supplier
 * id so the existing `supplier_mismatch` blocker path remains the assessment
 * contract.
 */
export function requireCanonicalOrderAutomationSupplierId(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Order automation requires a supplier id.");
  }
  const text = canonicalizeOrderAutomationSupplierId(value);
  if (!text) {
    throw new Error("Order automation requires a supplier id.");
  }
  return text;
}
