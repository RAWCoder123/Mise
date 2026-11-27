/**
 * Structural audit evidence for setup-attachment creator attribution.
 *
 * `setup_attachments.created_by` is nullable so account-deletion
 * anonymization can clear only the deleted operator's auth identity while
 * preserving the attachment's operational history (`ON DELETE SET NULL`).
 * Hosted `public.save_restaurant_setup` stamps `auth.uid()` into
 * `created_by` on INSERT.
 *
 * On current main, any INSERT that reaches the table (including direct
 * service_role inserts that satisfy soft CHECKs and RLS bypass) can still
 * mint a setup attachment with `created_by = null` — an unattributable
 * onboarding-import record that audit browse / compliance analysis cannot
 * pin to an owner, admin, or manager.
 *
 * This tip fails closed on INSERT when `created_by` is absent. It does not
 * restore table-level NOT NULL / CHECK (that would block auth anonymization
 * UPDATEs), rewrite `save_restaurant_setup`, or require metadata fields
 * beyond the existing soft CHECKs. Orthogonal to setup_attachments locale /
 * ASCII-C / kind-status pins, autonomy-rule created_by tip (#1303), and
 * audit-log / activity / inventory actor tips.
 */

function hasActor(value: string | null | undefined): boolean {
  return typeof value === "string" && Boolean(value.trim());
}

/**
 * Domain rejection reason for missing creator attribution on insert.
 * Returns null when a non-empty created_by id is present.
 */
export function validateSetupAttachmentCreatedByEvidence(input: {
  createdBy?: string | null;
}): string | null {
  if (!hasActor(input.createdBy)) {
    return "missing_created_by";
  }
  return null;
}
