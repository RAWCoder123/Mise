/**
 * Mise-actions application object identity helpers (MISE-005ME).
 *
 * Pins application-layer miseActions.ts `orderId` / `actionId` object tokens
 * outside the repository graph so Node tests can exercise inventing proofs
 * without loading Supabase or demo storage. Complements open Mise-actions
 * restaurant tip #738 (`Missing restaurant workspace.`) without sharing its
 * helper module or rewriting the restaurant workspace path.
 *
 * Intentionally does not change `restaurantId.trim()` on
 * `fetchMiseActions` / `fetchSupplierSendAction` / `decideMiseAction`, or the
 * `requireSupplierSendApprovalId(..., "restaurant workspace")` branch. Those
 * remain on Unicode trim here and are owned by #738 / MISE-005LH.
 * Intentionally does not rewrite `decideMiseAction`'s raw `actionId` pass-
 * through (no Unicode trim inventing surface today).
 *
 * Object IDs are not UUID-shaped on every path. Only ASCII end trim is pinned;
 * case is left unchanged to preserve the existing contract.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized Mise-action object identity.
 */
export function asciiTrimMiseActionsObjectToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Mise-actions object identity under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizeMiseActionsObjectId(value: string): string | null {
  const trimmed = asciiTrimMiseActionsObjectToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 128) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

export type MiseActionsObjectLabel = "supplier order" | "supplier send action";

/**
 * Fail-closed object require used by Mise-actions
 * `fetchSupplierSendAction` (`Missing supplier order.`) and
 * `requireSupplierSendApprovalId` for labels "supplier order" /
 * "supplier send action". Preserves the existing `Missing ${label}.` contract.
 */
export function requireCanonicalMiseActionsObjectId(
  value: unknown,
  label: MiseActionsObjectLabel
): string {
  if (typeof value !== "string") {
    throw new Error(`Missing ${label}.`);
  }
  const text = canonicalizeMiseActionsObjectId(value);
  if (!text) {
    throw new Error(`Missing ${label}.`);
  }
  return text;
}
