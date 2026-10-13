/**
 * Supplier-reliability domain supplier identity helpers (MISE-005OQ).
 *
 * Pins domain-layer `buildSupplierReliabilitySummary` Map-key grouping on
 * `order.supplier_id` outside the Orders application graph so Node tests can
 * exercise inventing proofs without loading Supabase or demo storage.
 * Complements open supplier-reliability restaurant tip #780 / MISE-005MX and
 * open order-automation supplier tip #773 / MISE-005MQ without sharing those
 * helper modules or rewriting restaurant / supplier-name paths.
 *
 * Intentionally does not change `input.restaurantId.trim()` (owned by #780 when
 * landed) or `order.supplier_name.trim()` presentation prep inside
 * `buildSupplierReliabilitySummary`. Supplier display names are not authority.
 *
 * Supplier IDs used as reliability grouping keys are not UUID-shaped on every
 * path (demo tokens remain valid). Only ASCII end trim is pinned; case is left
 * unchanged to preserve the existing exact-match contract. Invalid identities
 * fail closed into the existing empty-key `continue` skip rather than inventing
 * a clean Map key via Unicode trim
 * (`'\u2003uuid\u2003'.trim() === 'uuid'`).
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized supplier identity before deliveries are
 * grouped under one reliability entry.
 */
export function asciiTrimSupplierReliabilitySupplierToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a supplier-reliability supplier identity under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizeSupplierReliabilitySupplierId(value: string): string | null {
  const trimmed = asciiTrimSupplierReliabilitySupplierToken(value);
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
 * order-automation / deliveries tips:
 * `Supplier reliability requires a supplier id.`
 *
 * `buildSupplierReliabilitySummary` maps a null canonicalize result to the
 * existing empty-key skip (`continue`) so Unicode-padded supplier ids never
 * invent a clean grouping key.
 */
export function requireCanonicalSupplierReliabilitySupplierId(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Supplier reliability requires a supplier id.");
  }
  const text = canonicalizeSupplierReliabilitySupplierId(value);
  if (!text) {
    throw new Error("Supplier reliability requires a supplier id.");
  }
  return text;
}
