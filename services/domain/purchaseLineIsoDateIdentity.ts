/**
 * Purchase-line transactionDate / receivedDate identity helpers (MISE-005PX).
 *
 * Pins domain-layer `normalizePurchaseLineInput` ISO calendar-date fields
 * outside the repository graph so Node tests can exercise inventing proofs
 * without loading Supabase or demo storage. Those fields previously Unicode-
 * trimmed via local `isoDate`, so NBSP/em-space padding invented clean durable
 * ledger calendar tokens before ingestion
 * (`'\u00a02026-10-01\u00a0'.trim() === '2026-10-01'`,
 * `'\u20032026-10-01\u2003'.trim() === '2026-10-01'`).
 *
 * These are single-line ledger evidence keys (ISO calendar dates), not
 * free-form multiline prose. Only ASCII end trim is pinned. After ASCII prep,
 * the value must still match `YYYY-MM-DD` and parse as a real UTC calendar day;
 * Unicode-padded tokens fail closed rather than inventing equality with the
 * unpadded date. Live normalize preserves the prior
 * `${label} must be an ISO calendar date.` message.
 *
 * Complements open purchase-line tips #668 / MISE-005IZ (client unit-dimension
 * helpers), #728 / MISE-005KY (restaurant workspace), #764 / MISE-005MH
 * (lineId), #768 / MISE-005ML (sourceDocumentReference), #802 / MISE-005NT
 * (creditsLineId), #857 / MISE-005PW (optional unit/currency/pack), and #398
 * (calendar lookback/future skew bounds) without sharing their modules or
 * rewriting required `boundedText(rawItemDescription)` that still Unicode-
 * trims on main.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized purchase-line ISO calendar date before it
 * is stored as durable ledger evidence.
 */
export function asciiTrimPurchaseLineIsoDateToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

function isIsoCalendarDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/u.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  );
}

/**
 * Canonicalize a purchase-line ISO calendar-date token under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, containing
 * ASCII controls, or not a real `YYYY-MM-DD` calendar day.
 */
export function canonicalizePurchaseLineIsoDateToken(value: string): string | null {
  const trimmed = asciiTrimPurchaseLineIsoDateToken(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  if (!isIsoCalendarDate(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed ISO calendar-date normalize for `normalizePurchaseLineInput`.
 * Unsafe-control / Unicode-padded / non-ISO / non-string tokens fail with
 * `${label} must be an ISO calendar date.`
 */
export function normalizeCanonicalPurchaseLineIsoDate(
  value: unknown,
  label: string
): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be an ISO calendar date.`);
  }
  const canonical = canonicalizePurchaseLineIsoDateToken(value);
  if (!canonical) {
    throw new Error(`${label} must be an ISO calendar date.`);
  }
  return canonical;
}
