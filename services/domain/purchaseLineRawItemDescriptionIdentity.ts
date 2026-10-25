/**
 * Purchase-line required rawItemDescription identity helpers (MISE-005PY).
 *
 * Pins domain-layer `normalizePurchaseLineInput` required bounded-text
 * `rawItemDescription` outside the repository graph so Node tests can
 * exercise inventing proofs without loading Supabase or demo storage. That
 * field previously Unicode-trimmed via local `boundedText`, so NBSP/em-space
 * padding invented a clean durable ledger description before ingestion
 * (`'\u00a0Chicken Thighs 40 LB\u00a0'.trim() === 'Chicken Thighs 40 LB'`,
 * `'\u2003Olive Oil\u2003'.trim() === 'Olive Oil'`).
 *
 * Raw item description is a single-line ledger evidence string (the exact
 * document wording before normalization), not free-form multiline prose.
 * Prior `boundedText` already rejected full C0/DEL including LF/TAB/CR, so
 * this tip keeps that single-line control gate. Only ASCII end trim is
 * pinned; case and accents are left unchanged so presentation stays
 * document-faithful and downstream `normalizePurchaseLineDescription` still
 * sees the operator/document wording. Soft empty (ASCII whitespace or
 * Unicode-only space) fails closed with the prior bounded-printable message
 * rather than inventing a description from padding. Unicode-padded
 * non-empty tokens also fail closed rather than inventing equality with the
 * unpadded description.
 *
 * Complements open purchase-line tips #857 / MISE-005PW (optional
 * unit/currency/pack), #858 / MISE-005PX (ISO calendar dates), #668 /
 * MISE-005IZ (client unit-dimension helpers), #728 / MISE-005KY (restaurant
 * workspace), #764 / MISE-005MH (lineId), #768 / MISE-005ML
 * (sourceDocumentReference), and #802 / MISE-005NT (creditsLineId) without
 * sharing their modules or rewriting sibling `optionalBoundedText` /
 * `isoDate` surfaces that still Unicode-trim on main.
 *
 * Max length stays 500 to match the prior `boundedText(..., 500)` bound and
 * the hosted `private.purchase_line_text` / raw description limits. Live
 * normalize preserves the prior
 * `Raw item description must be bounded printable text.` message.
 */

import { PURCHASE_LINE_RAW_ITEM_DESCRIPTION_MAX_CHARACTERS } from "./securityLimits";

export { PURCHASE_LINE_RAW_ITEM_DESCRIPTION_MAX_CHARACTERS };

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized purchase-line raw description before it
 * is stored as durable ledger evidence.
 */
export function asciiTrimPurchaseLineRawItemDescriptionToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a purchase-line raw item description under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded,
 * over-long, or containing ASCII controls.
 */
export function canonicalizePurchaseLineRawItemDescriptionToken(
  value: string,
  maximum: number = PURCHASE_LINE_RAW_ITEM_DESCRIPTION_MAX_CHARACTERS
): string | null {
  const trimmed = asciiTrimPurchaseLineRawItemDescriptionToken(value);
  if (!trimmed) return null;
  if (trimmed.length > maximum) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed required rawItemDescription normalize for
 * `normalizePurchaseLineInput`. Soft empty / unsafe-control / Unicode-padded /
 * over-long / non-string tokens fail with
 * `Raw item description must be bounded printable text.`
 */
export function normalizeCanonicalPurchaseLineRawItemDescription(
  value: unknown
): string {
  const label = "Raw item description";
  const message = `${label} must be bounded printable text.`;
  if (typeof value !== "string") {
    throw new Error(message);
  }
  const canonical = canonicalizePurchaseLineRawItemDescriptionToken(value);
  if (canonical) return canonical;
  // Soft empty for ASCII whitespace or Unicode-only space: prior `.trim()`
  // emptied those into the same bounded-printable failure. Preserve that
  // contract rather than inventing a description from padding.
  throw new Error(message);
}
