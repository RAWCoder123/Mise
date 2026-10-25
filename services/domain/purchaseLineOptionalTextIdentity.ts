/**
 * Purchase-line optional unitOfMeasure / currency / packSize identity helpers
 * (MISE-005PW).
 *
 * Pins domain-layer `normalizePurchaseLineInput` optional bounded-text fields
 * outside the repository graph so Node tests can exercise inventing proofs
 * without loading Supabase or demo storage. Those fields previously Unicode-
 * trimmed via local `optionalBoundedText`, so NBSP/em-space padding invented
 * clean durable ledger tokens before ingestion (`'\u00a0USD\u00a0'.trim() ===
 * 'USD'`, `'\u2003lb\u2003'.trim() === 'lb'`, `'\u00a012ct\u00a0'.trim() ===
 * '12ct'`).
 *
 * These are single-line ledger evidence keys (unit, ISO currency, pack size),
 * not free-form multiline prose. Only ASCII end trim is pinned; case and
 * accents are left unchanged so presentation stays operator-faithful and
 * downstream ISO-4217 / unit checks still fail closed on unknown casing.
 * Soft empty (ASCII whitespace or Unicode-only space) stays soft-null so an
 * omitted optional field stays ordinary. Unicode-padded non-empty tokens fail
 * closed rather than inventing equality with the unpadded key.
 *
 * Complements open purchase-line tips #668 / MISE-005IZ (client unit-dimension
 * helpers), #728 / MISE-005KY (restaurant workspace), #764 / MISE-005MH
 * (lineId), #768 / MISE-005ML (sourceDocumentReference), and #802 /
 * MISE-005NT (creditsLineId) without sharing their modules or rewriting
 * required `boundedText(rawItemDescription)` / `isoDate` surfaces that still
 * Unicode-trim on main.
 *
 * Max lengths stay 80 / 3 / 80 to match the prior `optionalBoundedText` bounds
 * and the hosted `private.purchase_line_text` limits. Live normalize preserves
 * the prior `${label} must be bounded printable text.` message.
 */

import {
  PURCHASE_LINE_CURRENCY_MAX_CHARACTERS,
  PURCHASE_LINE_PACK_SIZE_MAX_CHARACTERS,
  PURCHASE_LINE_UNIT_OF_MEASURE_MAX_CHARACTERS
} from "./securityLimits";

export {
  PURCHASE_LINE_CURRENCY_MAX_CHARACTERS,
  PURCHASE_LINE_PACK_SIZE_MAX_CHARACTERS,
  PURCHASE_LINE_UNIT_OF_MEASURE_MAX_CHARACTERS
};

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized purchase-line optional text token before it
 * is stored as durable ledger evidence.
 */
export function asciiTrimPurchaseLineOptionalTextToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a purchase-line optional bounded-text token under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizePurchaseLineOptionalTextToken(
  value: string,
  maximum: number
): string | null {
  const trimmed = asciiTrimPurchaseLineOptionalTextToken(value);
  if (!trimmed) return null;
  if (trimmed.length > maximum) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed optional bounded-text normalize for `normalizePurchaseLineInput`.
 * Soft empty → `null`. Unsafe-control / Unicode-padded / over-long / non-string
 * tokens fail with `${label} must be bounded printable text.`
 */
export function normalizeCanonicalPurchaseLineOptionalText(
  value: unknown,
  label: string,
  maximum: number
): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") {
    throw new Error(`${label} must be bounded printable text.`);
  }
  const canonical = canonicalizePurchaseLineOptionalTextToken(value, maximum);
  if (canonical) return canonical;
  // Soft empty for ASCII whitespace or Unicode-only space: prior `.trim()`
  // emptied those. Do not invent an optional field from padding.
  if (!value.trim()) return null;
  throw new Error(`${label} must be bounded printable text.`);
}

/** Fail-closed unitOfMeasure normalize (max 80). Soft empty → null. */
export function normalizeCanonicalPurchaseLineUnitOfMeasure(
  value: unknown
): string | null {
  return normalizeCanonicalPurchaseLineOptionalText(
    value,
    "Unit of measure",
    PURCHASE_LINE_UNIT_OF_MEASURE_MAX_CHARACTERS
  );
}

/** Fail-closed currency normalize (max 3). Soft empty → null. */
export function normalizeCanonicalPurchaseLineCurrency(
  value: unknown
): string | null {
  return normalizeCanonicalPurchaseLineOptionalText(
    value,
    "Currency",
    PURCHASE_LINE_CURRENCY_MAX_CHARACTERS
  );
}

/** Fail-closed packSize normalize (max 80). Soft empty → null. */
export function normalizeCanonicalPurchaseLinePackSize(
  value: unknown
): string | null {
  return normalizeCanonicalPurchaseLineOptionalText(
    value,
    "Pack size",
    PURCHASE_LINE_PACK_SIZE_MAX_CHARACTERS
  );
}
