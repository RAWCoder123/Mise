/**
 * Pilot-readiness domain supplier identity helpers (MISE-005OR).
 *
 * Pins domain-layer `assessSupplierRouting` / `assessEmailDelivery` Set-key
 * identity on inventory and recipient `supplier_id` outside the Orders
 * application graph so Node tests can exercise inventing proofs without
 * loading Supabase or demo storage. Complements open supplier-reliability
 * supplier tip #825 / MISE-005OQ and tipped pilot-readiness restaurant
 * workspace #745 without sharing those helper modules or rewriting
 * restaurant / email presentation paths.
 *
 * Intentionally does not change `input.restaurantId.trim()` (owned by #745
 * when landed) or `recipient.email?.trim()` / `connection.sender_email?.trim()`
 * emptiness checks inside pilot readiness. Email presentation is not supplier
 * authority.
 *
 * Supplier IDs used as readiness Set keys are not UUID-shaped on every path
 * (demo tokens remain valid). Only ASCII end trim is pinned; case is left
 * unchanged to preserve the existing exact-match contract. Invalid identities
 * fail closed into the existing missing-supplier / empty-key filter rather
 * than inventing a clean Set key via Unicode trim
 * (`'\u2003uuid\u2003'.trim() === 'uuid'`).
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized supplier identity before readiness
 * counts suppliers or matches recipients.
 */
export function asciiTrimPilotReadinessSupplierToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a pilot-readiness supplier identity under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizePilotReadinessSupplierId(value: string): string | null {
  const trimmed = asciiTrimPilotReadinessSupplierToken(value);
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
 * supplier-reliability / order-automation tips:
 * `Pilot readiness requires a supplier id.`
 *
 * Routing and email-delivery assessments map a null canonicalize result to the
 * existing missing-supplier / empty-key filter so Unicode-padded supplier ids
 * never invent a clean Set key or falsely clear a missing-supplier blocker.
 */
export function requireCanonicalPilotReadinessSupplierId(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Pilot readiness requires a supplier id.");
  }
  const text = canonicalizePilotReadinessSupplierId(value);
  if (!text) {
    throw new Error("Pilot readiness requires a supplier id.");
  }
  return text;
}
