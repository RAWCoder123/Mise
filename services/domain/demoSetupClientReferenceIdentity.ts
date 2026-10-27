/**
 * Demo setup client-reference identity helpers (MISE-005SD).
 *
 * Pins `services/repositories/demoRepository.ts` `saveRestaurantSetupSnapshot`
 * supplier `client_reference_id` and inventory `supplier_client_reference_id`
 * Map-key prep outside Expo/AsyncStorage so Node tests can exercise inventing
 * proofs. The prior path fed Unicode `.trim()` into durable demo setup Map
 * keys that bind inventory drafts to supplier drafts, so NBSP / em-space
 * padding invented a clean client-reference identity
 * (`'\u2003supplier-1\u2003'.trim() === 'supplier-1'`). Soft empty /
 * Unicode-only space also invented the empty-reject branch via
 * `'\u2003'.trim() === ''`.
 *
 * These are replaceable-demo **setup client-reference** tokens only — not
 * application `requireSetupReferenceId` (open #769 / MISE-005MM), not demo
 * inventory/menu name keys (open #683 / MISE-005JN), not demo supplier
 * display-name (open #914 / MISE-005SB), and not hosted supplier identity.
 * Soft empty (missing, `""`, ASCII whitespace, or Unicode-only space) keeps
 * the prior empty-reject contracts. Ordinary ASCII whitespace still trims
 * clean before durable Map keys. Unicode-padded or control-bearing tokens
 * fail closed so padded `"supplier-1"` cannot invent a reviewed durable setup
 * reference.
 *
 * Complements open setup reference tip #769 / MISE-005MM without sharing that
 * module. Leave attachment `client_reference_id: attachment.id` (no trim),
 * demo inventory/menu name folds, and supplier display-name alone until their
 * own tips own those paths.
 */

const DEMO_SETUP_CLIENT_REFERENCE_MAX_CHARACTERS = 128;

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized demo setup client-reference Map key before
 * supplier↔inventory binding.
 */
export function asciiTrimDemoSetupClientReference(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a demo setup client-reference under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizeDemoSetupClientReference(
  value: string
): string | null {
  const trimmed = asciiTrimDemoSetupClientReference(value);
  if (!trimmed) return null;
  if (trimmed.length > DEMO_SETUP_CLIENT_REFERENCE_MAX_CHARACTERS) {
    return null;
  }
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed normalize for demo supplier setup `client_reference_id`.
 * Preserves soft empty → prior unique-reject contract while refusing
 * Unicode-padded tokens that would invent a durable Map key. Error contract:
 * `Supplier setup references must be unique.`
 */
export function requireCanonicalDemoSupplierSetupClientReference(
  value: unknown
): string {
  if (typeof value !== "string") {
    throw new Error("Supplier setup references must be unique.");
  }
  const canonical = canonicalizeDemoSetupClientReference(value);
  if (canonical) return canonical;
  throw new Error("Supplier setup references must be unique.");
}

/**
 * Fail-closed normalize for demo inventory `supplier_client_reference_id`.
 * Preserves soft empty → prior invalid-reject contract while refusing
 * Unicode-padded tokens that would invent a durable lookup key. Error
 * contract: `Inventory supplier setup reference is invalid.`
 */
export function requireCanonicalDemoInventorySupplierSetupClientReference(
  value: unknown
): string {
  if (typeof value !== "string") {
    throw new Error("Inventory supplier setup reference is invalid.");
  }
  const canonical = canonicalizeDemoSetupClientReference(value);
  if (canonical) return canonical;
  throw new Error("Inventory supplier setup reference is invalid.");
}

export { DEMO_SETUP_CLIENT_REFERENCE_MAX_CHARACTERS };
