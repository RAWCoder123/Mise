/**
 * Structural audit evidence for sales-import failure attribution.
 *
 * `sales_imports.error_message` is nullable because non-failure statuses
 * (`queued`, `processing`, `completed`) legitimately leave it null. Hosted
 * `service_record_square_sync_failure` already stamps a bounded error code into
 * `error_message` when INSERTing `status = 'failed'`.
 *
 * On current main, any INSERT that reaches the table can still mint a
 * `failed` import with `error_message` null or blank — a terminal failure
 * claim that Activity / audit analysis cannot explain. Client DML is revoked;
 * service_role / direct INSERT paths still reach the table.
 *
 * This tip fails closed on INSERT when status claims `failed` without a
 * non-empty `error_message`. It does not restore a table-level NOT NULL /
 * status-implies-error CHECK (that would block legitimate non-failure rows),
 * rewrite Square sync writers, or require failure evidence when status is
 * still queued / processing / completed. Orthogonal to tip stacks
 * #1263–#1321 and mise_actions failure evidence (#1305).
 */

export type SalesImportFailureStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed";

function hasText(value: string | null | undefined): boolean {
  return typeof value === "string" && Boolean(value.trim());
}

/**
 * Domain rejection reason for missing failure evidence on a sales-import
 * insert. Returns null when status is not failed, or when a non-empty
 * error_message is present.
 */
export function validateSalesImportFailureEvidence(input: {
  status?: SalesImportFailureStatus | string | null;
  errorMessage?: string | null;
}): string | null {
  if (input.status !== "failed") {
    return null;
  }
  if (!hasText(input.errorMessage)) {
    return "missing_error_message";
  }
  return null;
}
