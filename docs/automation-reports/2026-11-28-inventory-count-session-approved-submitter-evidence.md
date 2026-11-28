# Inventory count-session approved submitter evidence INSERT tip (2026-11-28)

## Gap

Soft CHECKs require `submitted_at` only when `status = 'submitted'`, and
`approved_at` when `status = 'approved'`. They do not require `submitted_by` on
an already-approved row. Direct / SECURITY DEFINER inserts can mint
`status = 'approved'` with approval evidence and `submitted_by` null, so audit
analysis cannot place the submit claim that every real approve inherits.
Client DML is already revoked; service_role / direct INSERT paths still reach
the table.

## Change

- Domain: `validateInventoryCountSessionApprovedSubmitterEvidence` →
  `missing_submitted_by`
- Additive BEFORE INSERT tip only (no NOT NULL / status-implies-submitted_by
  CHECK for approved rows)
- pgTAP plan = 9 (derived from assertion call sites)

## Alone-OK

Orthogonal to #1295 (started_by), #1296 (workflow actors — `approved_by` for
approved, not `submitted_by`), and #1320 (approved `submitted_at`). Contested
merge: #1296 attributed approved fixture needs `submitted_by` once this lands.
Does not rewrite begin/submit/approve/cancel writers; approve UPDATEs stay
INSERT-tip-safe; anonymization UPDATEs remain allowed.

## Verification

Recorded in the PR body after local runs on this branch.
