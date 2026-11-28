# Outreach enrollment processing claimed_at evidence (2026-11-28)

## Gap

`public.outreach_enrollments.claimed_at` is nullable for queued / ready /
contacted / completed / suppressed enrollments. Soft constraints do not require
`claimed_at` when `status = 'processing'`. Tips #1333/#1334 close contacted /
completed `last_sent_at` INSERT only. Direct / service_role inserts can mint
`status = 'processing'` with `claimed_at` null. Hosted claim stamps
`claimed_at` on UPDATE into processing. Authenticated client DML is revoked;
enrollment writers INSERT queued / ready / awaiting_review then stamp claim
time on UPDATE.

## Change

- Domain: `validateOutreachEnrollmentProcessingClaimedAtEvidence` → `missing_claimed_at`
- Additive BEFORE INSERT tip only (no NOT NULL / status-implies-timestamp CHECK)
- pgTAP plan = 9 (derived from assertion call sites)

## Alone-OK

Orthogonal to tip stacks #1263–#1334, including outreach enrollment
contacted/completed last_sent_at (#1333/#1334) and OAuth claimed_at tips
(#1330/#1331). Soft contested merge: none expected. Enrollment writer
unaffected. Claim UPDATEs remain allowed. Contacted/completed-without-
last_sent_at INSERT remain #1333/#1334 boundaries under this tip.

## Verification

- `npm run typecheck` — passed
- focused processing claimed_at suite — 4/4 passed
- `npm test` — 687 / 687 pass / 0 fail / 0 cancelled
- `npm run security:static` — passed
- `npm run security:backend` — passed
- `npm run design:static` — passed
- Docker unavailable for `npm run supabase:test`
