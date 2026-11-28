/**
 * Structural audit evidence for Gmail OAuth flow claim-time attribution on
 * completed flows.
 *
 * `private.gmail_oauth_flows.claimed_at` is nullable because open flows and
 * pre-claim failures legitimately leave it null. Soft table constraints only
 * forbid completed_at and failed_at together; they do not require claimed_at
 * when completed_at is set. Hosted `service_complete_gmail_oauth` requires an
 * already-claimed flow before stamping completed_at on UPDATE. Hosted
 * `service_fail_gmail_oauth` may fail an unclaimed flow (user denial, expiry,
 * superseded begin) and must remain allowed.
 *
 * On current main, any INSERT that reaches the table can still mint a row
 * with `completed_at` set and `claimed_at` null — a "completed" OAuth flow
 * that was never claimed. Client and service_role DML are already revoked;
 * SECURITY DEFINER / direct INSERT paths still reach the table. Begin writers
 * INSERT open flows with claimed_at and completed_at null, then stamp claim
 * and completion on later UPDATEs.
 *
 * This tip fails closed on INSERT when completed_at is present without a
 * non-null claimed_at. It does not restore a table-level NOT NULL /
 * completed-implies-claimed CHECK (that would also force claim evidence on
 * UPDATE paths outside this tip's INSERT boundary), rewrite Gmail OAuth
 * writers, or require claimed_at for open or failed flows. Orthogonal to tip
 * stacks #1263–#1329, including the sibling Gmail OAuth failure-evidence tip
 * (#1325). Sibling of Square OAuth claim-time evidence (when invented). Soft
 * contested merge with #1325's "completed_at without failure evidence"
 * fixture, which currently omits claimed_at — landing order must stamp
 * claimed_at on that assertion.
 */

function hasTimestamp(value: string | Date | null | undefined): boolean {
  if (value instanceof Date) {
    return !Number.isNaN(value.getTime());
  }
  return typeof value === "string" && Boolean(value.trim());
}

/**
 * Domain rejection reason for missing claim-time evidence on a completed
 * Gmail OAuth flow insert. Returns null when completed_at is absent, or when
 * a claimed_at timestamp is present.
 */
export function validateGmailOauthClaimedAtEvidence(input: {
  completedAt?: string | Date | null;
  claimedAt?: string | Date | null;
}): string | null {
  if (!hasTimestamp(input.completedAt)) {
    return null;
  }
  if (!hasTimestamp(input.claimedAt)) {
    return "missing_claimed_at";
  }
  return null;
}
