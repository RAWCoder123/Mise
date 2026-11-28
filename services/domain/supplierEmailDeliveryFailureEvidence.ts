/**
 * Structural audit evidence for supplier-email delivery failure attribution.
 *
 * `private.supplier_email_deliveries.last_error_code` is nullable because
 * in-flight `sending` rows and successful `sent` rows legitimately leave it
 * null. Hosted fail / unknown transitions already stamp a bounded slug into
 * `last_error_code` when moving a claim out of `sending`.
 *
 * On current main, any INSERT that reaches the table can still mint a
 * `failed` or `unknown` delivery with `last_error_code` null or blank — a
 * terminal non-success claim that Activity / audit analysis cannot explain.
 * Client and service_role DML are already revoked; SECURITY DEFINER /
 * direct INSERT paths still reach the table.
 *
 * This tip fails closed on INSERT when status claims `failed` or `unknown`
 * without a non-empty `last_error_code`. It does not restore a table-level
 * NOT NULL / status-implies-error CHECK (that would block legitimate sending
 * / sent rows), rewrite Gmail claim writers, or require failure evidence when
 * status is still `sending` or already `sent`. Orthogonal to tip stacks
 * #1263–#1322 and mise_actions failure evidence (#1305).
 */

export type SupplierEmailDeliveryFailureStatus =
  | "sending"
  | "sent"
  | "failed"
  | "unknown";

function hasText(value: string | null | undefined): boolean {
  return typeof value === "string" && Boolean(value.trim());
}

/**
 * Domain rejection reason for missing failure evidence on a supplier-email
 * delivery insert. Returns null when status is sending/sent, or when a
 * non-empty last_error_code is present for failed/unknown.
 */
export function validateSupplierEmailDeliveryFailureEvidence(input: {
  status?: SupplierEmailDeliveryFailureStatus | string | null;
  lastErrorCode?: string | null;
}): string | null {
  if (input.status !== "failed" && input.status !== "unknown") {
    return null;
  }
  if (!hasText(input.lastErrorCode)) {
    return "missing_last_error_code";
  }
  return null;
}
