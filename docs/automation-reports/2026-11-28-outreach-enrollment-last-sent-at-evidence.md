# Outreach enrollment last_sent_at evidence (2026-11-28)

## Gap

`public.outreach_enrollments.last_sent_at` is nullable for queued / ready /
processing / suppressed enrollments. Soft constraints do not require
`last_sent_at` when `status = 'contacted'`. Direct / service_role inserts can
mint `status = 'contacted'` with `last_sent_at` null. Hosted send stamps
`last_sent_at` on UPDATE. Authenticated client DML is revoked; enrollment
writers INSERT queued then stamp send time on UPDATE.

## Change

- Domain: `validateOutreachEnrollmentLastSentAtEvidence` → `missing_last_sent_at`
- Additive BEFORE INSERT tip only (no NOT NULL / status-implies-timestamp CHECK)
- pgTAP plan = 9 (derived from assertion call sites)

## Alone-OK

Orthogonal to tip stacks #1263–#1332, including outreach message sent_at
(#1328), outreach agent run completed_at (#1329), and outreach campaign
activated_at (#1332). Soft contested merge: none expected. Enrollment writer
unaffected. Send UPDATEs remain allowed.

## Verification

- `npm run typecheck` — passed
- focused last_sent_at suite — 4/4 passed
- `npm test` — 687 / 680 pass / 0 fail / 7 cancelled
- `npm run security:static` — passed
- `npm run security:backend` — passed
- `npm run design:static` — passed
- Docker unavailable for `npm run supabase:test`
