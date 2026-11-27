# Inventory count-session approved submit-time evidence INSERT tip (2026-11-27)

## Gap

Soft CHECKs require `submitted_at` only when `status = 'submitted'`, and
`approved_at` when `status = 'approved'`. They do not require `submitted_at` on
an already-approved row. Direct / SECURITY DEFINER inserts can mint
`status = 'approved'` with approval evidence and `submitted_at` null, so audit
analysis cannot place the submit claim that every real approve inherits.
Client DML is already revoked; service_role / direct INSERT paths still reach
the table.

## Change

- Domain: `validateInventoryCountSessionApprovedSubmitTimeEvidence` →
  `missing_submitted_at`
- Additive BEFORE INSERT tip only (no NOT NULL / status-implies-submitted_at
  CHECK for approved rows)
- pgTAP plan = 9 (derived from assertion call sites)

## Alone-OK

Orthogonal to #1295 (started_by) and #1296 (terminal workflow actors). Contested
merge: #1296 attributed approved fixture needs `submitted_at` once this lands.
Does not rewrite begin/submit/approve/cancel writers; approve UPDATEs stay
INSERT-tip-safe.

## Verification

Recorded in the PR body after local runs on this branch.
