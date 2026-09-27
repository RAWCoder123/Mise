# MISE-005AV: pin operational_issues.dedupe_key CHECK to COLLATE C

Date: 2026-09-27
Branch: `cursor/mise-operational-issues-dedupe-key-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Replace the length-only CHECK on `public.operational_issues.dedupe_key`:

- before: `length(trim(dedupe_key)) between 1 and 240`
- after: `dedupe_key collate "C" ~ '^[A-Za-z0-9:_-]{1,240}$'`

## Writer vocabulary

Confirmed ASCII mints only:

- foundation trigger / backfill:
  `format('inventory-risk:%s', inventory_item_id)` (UUID)
- pgTAP fixture:
  `inventory-risk:d0000000-0000-4000-8000-000000000011`

No client-facing free-form write path; authenticated clients hold SELECT only.

## Scope

- CHECK-only; does **not** rewrite the purchase_recommendations sync trigger
- Does **not** touch `restaurant_memories.dedupe_key` (supplier-name legacy
  keys), `activity_events.idempotency_key` (ISO / label mints),
  inventory_events identity (#375), or restaurant_tasks.client_task_id (#455)
- Alone on main OK; timestamp after #455

## Verification

- `npm run typecheck`
- focused `tests/operationalIssuesDedupeKeyLocalePin.test.ts`
- `npm test`
- pgTAP fixture committed; Docker/hosted pgTAP not run here

## Files

- `supabase/migrations/20260927190000_mise_005av_operational_issues_dedupe_key_locale_pin.sql`
- `supabase/tests/database/operational_issues_dedupe_key_locale_pin.test.sql`
- `tests/operationalIssuesDedupeKeyLocalePin.test.ts`
- `docs/automation-reports/2026-09-27-operational-issues-dedupe-key-locale-pin.md`
