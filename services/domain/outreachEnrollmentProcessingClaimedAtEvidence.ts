/**
 * Structural audit evidence for processing outreach enrollment claim-time
 * attribution.
 *
 * `public.outreach_enrollments.claimed_at` is nullable because queued /
 * awaiting_review / ready / contacted / replied / completed / suppressed /
 * attention_required rows legitimately leave it null until a later claim
 * UPDATE stamps the timestamp (and claim-release / timeout paths clear it
 * again). Soft table constraints do not require `claimed_at` when `status`
 * claims `processing`. Tips #1333/#1334 close contacted/completed
 * `last_sent_at` INSERT gaps only; processing claim-time inserts remain
 * unconstrained on current main and on those tips.
 *
 * Hosted claim transitions already stamp `claimed_at` when UPDATEing into
 * `processing`. On current main, any INSERT that reaches the table can still
 * mint `status = 'processing'` with `claimed_at` null — a "processing"
 * enrollment that audit analysis cannot place in claim time. Authenticated
 * client DML is already revoked; service_role retains INSERT and can still
 * mint untimed processing claims directly. Enrollment writers INSERT
 * `status = 'queued'` (or ready / awaiting_review) with `claimed_at` null,
 * then stamp evidence on the claim UPDATE.
 *
 * This tip fails closed on INSERT when status claims `processing` without a
 * non-null `claimed_at`. It does not restore a table-level NOT NULL /
 * status-implies-timestamp CHECK (that would expand beyond this INSERT-only
 * tip boundary), rewrite outreach-agent writers, or require claim time when
 * status is still queued / ready / contacted / completed / replied /
 * suppressed. Orthogonal to tip stacks #1263–#1334, including outreach
 * enrollment contacted/completed last_sent_at (#1333/#1334) and OAuth
 * claimed_at tips (#1330/#1331). Soft contested merge: none expected —
 * processing INSERT fixtures are rare; create writers stay
 * queued/ready/awaiting_review-only.
 */

export type OutreachEnrollmentProcessingClaimedAtStatus =
  | "queued"
  | "awaiting_review"
  | "ready"
  | "processing"
  | "contacted"
  | "replied"
  | "interested"
  | "not_interested"
  | "completed"
  | "suppressed"
  | "attention_required";

function hasTimestamp(value: string | Date | null | undefined): boolean {
  if (value instanceof Date) {
    return !Number.isNaN(value.getTime());
  }
  return typeof value === "string" && Boolean(value.trim());
}

function requiresClaimedAt(status: string | null | undefined): boolean {
  return status === "processing";
}

/**
 * Domain rejection reason for missing claim-time attribution on a processing
 * outreach enrollment insert. Returns null when status is not processing, or
 * when a non-empty claimed_at value is present for processing status.
 */
export function validateOutreachEnrollmentProcessingClaimedAtEvidence(input: {
  status?: OutreachEnrollmentProcessingClaimedAtStatus | string | null;
  claimedAt?: string | Date | null;
}): string | null {
  if (!requiresClaimedAt(input.status)) {
    return null;
  }
  if (!hasTimestamp(input.claimedAt)) {
    return "missing_claimed_at";
  }
  return null;
}
