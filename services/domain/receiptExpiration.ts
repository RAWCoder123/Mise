/**
 * Optional lot use-by dating captured when an operator records a receipt.
 *
 * Dates are calendar keys (YYYY-MM-DD) only — never invented from shelf life,
 * never inferred for order-path receives that omit them, and never accepted on
 * non-receipt inventory events.
 */

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Absolute calendar bounds so absurd past/future values cannot enter the ledger. */
export const RECEIPT_EXPIRES_ON_MIN = "2000-01-01";
export const RECEIPT_EXPIRES_ON_MAX = "2100-12-31";

export function isCalendarDateKey(value: string): boolean {
  const match = DATE_KEY.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Soft-null display/read helper. Invalid or out-of-bound values are omitted
 * rather than rendered as inventable free text.
 */
export function expiresOnFromMetadata(
  metadata: Readonly<Record<string, unknown>> | undefined | null
): string | null {
  if (!metadata) return null;
  return normalizeReceiptExpiresOn(metadata.expires_on);
}

/**
 * Normalize optional operator input. Blank becomes null. Invalid shapes throw
 * so the client fails closed before queuing ledger evidence.
 */
export function requireOptionalReceiptExpiresOn(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") {
    throw new Error("Use YYYY-MM-DD for the use-by date, or leave it blank.");
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = normalizeReceiptExpiresOn(trimmed);
  if (!normalized) {
    throw new Error("Use YYYY-MM-DD for the use-by date, or leave it blank.");
  }
  return normalized;
}

/** Returns a validated calendar key or null when the value is not usable. */
export function normalizeReceiptExpiresOn(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!isCalendarDateKey(trimmed)) return null;
  if (trimmed < RECEIPT_EXPIRES_ON_MIN || trimmed > RECEIPT_EXPIRES_ON_MAX) return null;
  return trimmed;
}
