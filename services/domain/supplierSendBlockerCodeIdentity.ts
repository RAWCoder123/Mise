/**
 * Order-detail supplier-send blocker-code identity helpers (MISE-005SV).
 *
 * Pins `app/orders/[id].tsx` `safeBlockerCodes` presentation/routing prep
 * outside the React Native screen graph so Node tests can exercise inventing
 * proofs without loading Expo. The prior path Unicode-trimmed each
 * `error.blockerCodes` entry before notice routing
 * (`'\u2003send_content_changed\u2003'.trim() === 'send_content_changed'`), so
 * NBSP / em-space padding invented equality with a clean blocker token that
 * `supplierSendBlockerNotice` / purchase-authority recovery branches match by
 * exact string.
 *
 * These are single-line supplier-send blocker codes used only for order-detail
 * Gmail/send error notice routing, not free-form multiline prose and not the
 * hosted repository `parseSupplierSendBlockerCodes` path (exact Set membership,
 * no trim). Soft empty (ASCII whitespace or Unicode-only space) and
 * Unicode-padded non-empty tokens soft-drop from the array so callers keep the
 * prior `.trim()` + `filter(Boolean)` emptiness contract rather than inventing
 * a clean blocker identity. Ordinary ASCII whitespace still trims clean.
 * Per-code length is capped at 80 and array length at 20 to stay aligned with
 * the hosted parser bounds.
 *
 * Complements open Gmail integration error-message tip (#930 / MISE-005SR) and
 * supplier operator_note tip (#840 / MISE-005PF) without rewriting those
 * modules or the order-detail `operator_note` / `generatedOrderMessage` paths.
 */

/** Prior hosted `parseSupplierSendBlockerCodes` per-entry length bound. */
export const SUPPLIER_SEND_BLOCKER_CODE_MAX_CHARACTERS = 80;

/** Prior `safeBlockerCodes` / hosted parser array length bound. */
export const SUPPLIER_SEND_BLOCKER_CODE_MAX_COUNT = 20;

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized blocker code before notice routing.
 */
export function asciiTrimSupplierSendBlockerCode(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a supplier-send blocker code under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, control-
 * bearing, or longer than the hosted 80-character bound.
 */
export function canonicalizeSupplierSendBlockerCode(value: string): string | null {
  const trimmed = asciiTrimSupplierSendBlockerCode(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  if (trimmed.length > SUPPLIER_SEND_BLOCKER_CODE_MAX_CHARACTERS) return null;
  return trimmed;
}

/**
 * Soft normalize one supplier-send blocker code for order-detail notice
 * routing. Preserves soft empty → `null` (prior `.trim()` emptiness via
 * `filter(Boolean)`) while refusing to invent a clean blocker via Unicode
 * em-space / NBSP trim. Non-string, control-bearing, over-long, and
 * Unicode-padded tokens soft to `null`.
 */
export function normalizeSupplierSendBlockerCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (value === "") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those into the `filter(Boolean)` drop.
  if (!value.trim()) return null;
  return canonicalizeSupplierSendBlockerCode(value);
}

/**
 * Soft normalize an unknown `error.blockerCodes` payload for order-detail
 * notice routing. Preserves non-array → `[]` and the prior 20-entry cap while
 * soft-dropping inventing / unsafe entries instead of inventing clean codes.
 */
export function normalizeSupplierSendBlockerCodes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const codes: string[] = [];
  for (const entry of value) {
    if (codes.length >= SUPPLIER_SEND_BLOCKER_CODE_MAX_COUNT) break;
    const normalized = normalizeSupplierSendBlockerCode(entry);
    if (normalized) codes.push(normalized);
  }
  return codes;
}
