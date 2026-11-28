/**
 * Structural audit evidence for Square OAuth flow failure attribution.
 *
 * `private.square_oauth_flows.failure_code` is nullable because open flows
 * (no `failed_at`) and successful completions (`completed_at`) legitimately
 * leave it null. Hosted `service_fail_square_oauth` already stamps a bounded
 * slug into `failure_code` when UPDATEing `failed_at`.
 *
 * On current main, any INSERT that reaches the table can still mint a row
 * with `failed_at` set and `failure_code` null or blank — a terminal OAuth
 * failure that Activity / audit analysis cannot explain. Client and
 * service_role DML are already revoked; SECURITY DEFINER / direct INSERT
 * paths still reach the table.
 *
 * This tip fails closed on INSERT when `failed_at` is present without a
 * non-empty `failure_code`. It does not restore a table-level NOT NULL /
 * failed_at-implies-code CHECK (that would block legitimate open / completed
 * rows), rewrite Square OAuth writers, or require failure evidence when the
 * flow is still open or already completed. Orthogonal to tip stacks
 * #1263–#1323 and mise_actions failure evidence (#1305).
 */

function hasText(value: string | null | undefined): boolean {
  return typeof value === "string" && Boolean(value.trim());
}

function hasTimestamp(value: string | Date | null | undefined): boolean {
  if (value instanceof Date) {
    return !Number.isNaN(value.getTime());
  }
  return typeof value === "string" && Boolean(value.trim());
}

/**
 * Domain rejection reason for missing failure evidence on a Square OAuth
 * flow insert. Returns null when failed_at is absent, or when a non-empty
 * failure_code is present.
 */
export function validateSquareOauthFailureEvidence(input: {
  failedAt?: string | Date | null;
  failureCode?: string | null;
}): string | null {
  if (!hasTimestamp(input.failedAt)) {
    return null;
  }
  if (!hasText(input.failureCode)) {
    return "missing_failure_code";
  }
  return null;
}
