# MISE-005AT: pin finding-decision identity CHECKs to COLLATE C

Date: 2026-09-27
Branch: `cursor/mise-finding-decision-identity-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Replace length-only CHECKs on `public.operational_finding_decisions`:

- `client_event_id` → `client_event_id collate "C" ~ '^[A-Za-z0-9:_-]{1,200}$'`
- `idempotency_key` → `idempotency_key collate "C" ~ '^[A-Za-z0-9:_-]{1,240}$'`

## Writer vocabulary

Confirmed ASCII mints from `services/application/findingDecisionOutbox.ts`:

- `clientEventId = createId("finding_decision")` → `finding_decision_<uuid>`
- `idempotencyKey = finding-decision:${clientEventId}`

Unit fixtures use the same class (`device-a:finding-decision-2`,
`finding-decision:device-a:1`).

## Scope

- CHECK-only; does **not** rewrite `public.record_operational_finding_decision`
- Does **not** touch finding_id (#442), policy_version (#440), recalculation
  job_name (#453), or purchase_decision source_event_key (#451)
- Alone on main OK; timestamp after #453

## Verification

- `npm run typecheck`
- focused `tests/findingDecisionIdentityLocalePin.test.ts`
- `npm test`
- pgTAP fixture committed; Docker/hosted pgTAP not run here

## Files

- `supabase/migrations/20260927170000_mise_005at_finding_decision_identity_locale_pin.sql`
- `supabase/tests/database/finding_decision_identity_locale_pin.test.sql`
- `tests/findingDecisionIdentityLocalePin.test.ts`
- `docs/automation-reports/2026-09-27-finding-decision-identity-locale-pin.md`
