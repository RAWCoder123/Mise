# Export purchase decision events via service role

Date: 2026-09-25  
Branch: `cursor/mise-export-purchase-decision-events-service-read`  
Base: `origin/main` @ `78da737` (MISE-005A)

## Problem

MISE-004A made `public.purchase_decision_events` service-role SELECT only so
authenticated clients cannot read raw actor-level purchase decision evidence
through the Data API. The Settings → Export edge function still listed that
table and read every dataset with the caller JWT client. Hosted export therefore
failed closed as soon as it reached `purchase_decision_events`, while demo
export (local state) continued to succeed — a privacy-workflow and
demo/hosted parity break.

## Fix

After owner/admin membership is proven with the user JWT, datasets marked in
`serviceRoleExportDatasets` are read through `securitySupabase`, still filtered
with `.eq("restaurant_id", restaurantId)`. Authenticated SELECT is not restored.

## Verification

- Focused: `tests/restaurantDataExport.test.ts`
- `npm run typecheck`
- `npm test` (or focused export + related pins)
- `npm run security:static` / `npm run security:backend` when available

## Out of scope

- Granting authenticated SELECT on `purchase_decision_events`
- Adding `inventory_count_sessions` / `inventory_count_lines` to export
- Landing open ledger stacks #348–#399
