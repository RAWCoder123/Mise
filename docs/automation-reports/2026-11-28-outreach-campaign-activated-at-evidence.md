# Outreach campaign activated_at evidence (2026-11-28)

## Gap

`public.outreach_campaigns.activated_at` is nullable for draft / paused /
completed campaigns. Soft constraints only require `approved_at` when
`status = 'active'`. Direct / service_role inserts can mint `status = 'active'`
with `approved_at` set and `activated_at` null. Hosted activate stamps both
timestamps on UPDATE. Authenticated client DML is revoked; create writers
INSERT draft then activate on UPDATE.

## Change

- Domain: `validateOutreachCampaignActivatedAtEvidence` → `missing_activated_at`
- Additive BEFORE INSERT tip only (no NOT NULL / status-implies-timestamp CHECK)
- pgTAP plan = 9 (derived from assertion call sites)

## Alone-OK

Orthogonal to tip stacks #1263–#1331, including outreach message sent_at
(#1328), outreach agent run completed_at (#1329), and Square / Gmail OAuth
claim-time evidence (#1330 / #1331). Soft contested merge: none expected.
Create writer unaffected. Activate UPDATEs remain allowed.

## Verification

- `npm run typecheck` — passed
- focused activated_at suite — 4/4 passed
- `npm test` — 687 / 680 pass / 0 fail / 7 cancelled
- `npm run security:static` — passed
- `npm run security:backend` — passed
- `npm run design:static` — passed
- Docker unavailable for `npm run supabase:test`
