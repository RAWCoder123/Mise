/**
 * POS application mapping / menu-item workflow identity helpers (MISE-005MB).
 *
 * Pins application-layer pos.ts `requireWorkflowId` labels "mapping" and
 * "menu item" outside the repository graph so Node tests can exercise
 * inventing proofs without loading Supabase or demo storage. Complements
 * open POS restaurant tip #757 (`A valid restaurant id is required.`) without
 * sharing its helper module or rewriting the restaurant label.
 *
 * Intentionally does not change `requireWorkflowId(..., "restaurant")`. That
 * path remains on Unicode trim here and is owned by #757 / MISE-005MA.
 *
 * Mapping and menu-item IDs are not UUID-shaped on every path (demo tenants
 * use tokens such as `demo-menu:…`). Only ASCII end trim is pinned; case is
 * left unchanged to preserve the existing contract.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized mapping or menu-item identity.
 */
export function asciiTrimPosMappingWorkflowToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a POS mapping or menu-item workflow identity under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizePosMappingWorkflowId(value: string): string | null {
  const trimmed = asciiTrimPosMappingWorkflowToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 128) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

export type PosMappingWorkflowLabel = "mapping" | "menu item";

/**
 * Fail-closed mapping / menu-item require used by POS
 * `requireWorkflowId(..., "mapping" | "menu item")`. Preserves the existing
 * `A valid ${label} id is required.` error contract.
 */
export function requireCanonicalPosMappingWorkflowId(
  value: unknown,
  label: PosMappingWorkflowLabel
): string {
  if (typeof value !== "string") {
    throw new Error(`A valid ${label} id is required.`);
  }
  const text = canonicalizePosMappingWorkflowId(value);
  if (!text) {
    throw new Error(`A valid ${label} id is required.`);
  }
  return text;
}
