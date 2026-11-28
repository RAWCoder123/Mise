/**
 * Structural audit evidence for outreach campaign activation-time attribution.
 *
 * `public.outreach_campaigns.activated_at` is nullable because draft / paused /
 * completed rows legitimately leave it null until a later activate UPDATE
 * stamps the timestamp. Soft table constraints only require `approved_at`
 * when `status = 'active'` (`outreach_campaign_activation_approved`). They do
 * not require `activated_at` when status claims active.
 *
 * Hosted `activateCampaign` already stamps both `approved_at` and
 * `activated_at` when UPDATEing into `active`. On current main, any INSERT
 * that reaches the table can still mint `status = 'active'` with
 * `approved_at` set and `activated_at` null — an "active" campaign that
 * audit analysis cannot place in activation time. Authenticated client DML
 * is already revoked; service_role retains INSERT and can still mint untimed
 * active claims directly. Create writers INSERT `status = 'draft'` with
 * `activated_at` null, then stamp evidence on the activate UPDATE.
 *
 * This tip fails closed on INSERT when status claims `active` without a
 * non-null `activated_at`. It does not restore a table-level NOT NULL /
 * status-implies-timestamp CHECK (that would expand beyond this INSERT-only
 * tip boundary), rewrite outreach-agent writers, or require activation time
 * when status is still draft / paused / completed. Orthogonal to tip stacks
 * #1263–#1331, including outreach message sent_at (#1328), outreach agent
 * run completed_at (#1329), and Square / Gmail OAuth claim-time evidence
 * (#1330 / #1331). Soft contested merge: none expected — activation fixtures
 * that INSERT active rows are rare; create writers stay draft-only.
 */

export type OutreachCampaignActivatedAtStatus =
  | "draft"
  | "active"
  | "paused"
  | "completed";

function hasTimestamp(value: string | Date | null | undefined): boolean {
  if (value instanceof Date) {
    return !Number.isNaN(value.getTime());
  }
  return typeof value === "string" && Boolean(value.trim());
}

function requiresActivationTime(status: string | null | undefined): boolean {
  return status === "active";
}

/**
 * Domain rejection reason for missing activation-time attribution on an
 * outreach campaign insert. Returns null when status is not active, or when
 * a non-empty activated_at value is present for active status.
 */
export function validateOutreachCampaignActivatedAtEvidence(input: {
  status?: OutreachCampaignActivatedAtStatus | string | null;
  activatedAt?: string | Date | null;
}): string | null {
  if (!requiresActivationTime(input.status)) {
    return null;
  }
  if (!hasTimestamp(input.activatedAt)) {
    return "missing_activated_at";
  }
  return null;
}
