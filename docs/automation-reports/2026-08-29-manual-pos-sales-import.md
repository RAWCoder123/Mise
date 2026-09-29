# Manual POS sales import after setup (2026-08-29)

## Verdict

Settings → Sales Import no longer calls `saveRestaurantSetup` after day-0
completion. Managers can append/upsert Manual CSV Upload sales and refresh
demand signals through a dedicated, role-gated import path.

## Problem

`save_restaurant_setup` rejects any non-fingerprint replay once
`setup_completed` exists. Sales Import still used that RPC with empty
inventory/supplier/recipe arrays, so post-setup CSV imports always failed for
real restaurants and demo tenants that had finished onboarding.

## Change

- Domain planner `planManualPosSalesImport` validates Manual CSV Upload drafts.
- Application `importManualPosSales` persists via repository and regenerates signals.
- Hosted RPC `public.import_manual_pos_sales` + operational-workflows action.
- Demo repository parity with `sales_imports` + audit ledger rows.
- Sales Import UI retargeted + restaurant-switch draft isolation (supersedes #153 file scope).

## Paths

- `services/domain/manualPosSalesImport.ts`
- `services/application/manualPosSalesImport.ts`
- `services/miseService.ts`
- `services/repositories/{repositoryContracts,demoRepository,supabaseRepository}.ts`
- `supabase/migrations/20260829230000_import_manual_pos_sales.sql`
- `supabase/functions/operational-workflows/index.ts`
- `supabase/tests/database/import_manual_pos_sales.test.sql`
- `app/settings/sales-import.tsx`
- `tests/manualPosSalesImport.test.ts`

## Verification

- `npm run typecheck`
- `npm test`
- `npm run security:backend`
- `npm run security:static`
