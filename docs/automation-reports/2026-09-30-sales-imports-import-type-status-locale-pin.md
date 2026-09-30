# MISE-005DD: pin sales_imports.import_type and status CHECKs to COLLATE C

Date: 2026-09-30
Branch: `cursor/mise-sales-imports-import-type-status-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Replace the bare-IN `sales_imports.import_type` and `sales_imports.status`
allowlists with the exact-token contracts plus ASCII shape under COLLATE
`"C"`:

```sql
import_type in ('pos_sync', 'csv_upload', 'manual_adjustment')
and import_type collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'

status in ('queued', 'processing', 'completed', 'failed')
and status collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
```

## Writer vocabulary

Confirmed ASCII mint (Square sync / POS import writers, demo CSV imports,
and table CHECKs from restaurant_ops_backbone):

import_type:

- `pos_sync` — Square/provider sync import
- `csv_upload` — operator CSV sales upload
- `manual_adjustment` — manager correction import

status:

- `queued` — accepted, not yet running
- `processing` — sync/import in flight
- `completed` — finished with truthful counts
- `failed` — failed closed with error metadata

Exact-token allowlists are preserved; this tip adds the COLLATE C ASCII
shape gate alongside them.

## Why

MISE-005A proved locale drift on this cluster. Open sibling pin #474 covers
`sales_imports.source_file_name`, but leave `sales_imports.import_type` and
`sales_imports.status` on bare IN only. Without dedicated COLLATE C shape
CHECKs, dump/restore under LC_CTYPE drift can accept import-vocabulary bytes
the restored C-locale path would refuse — or the reverse — breaking
sales-import continuity across restore.

## Scope

- CHECK-only on `public.sales_imports.import_type` and `public.sales_imports.status`
- Does **not** rewrite Square sync / POS import writers
- Does **not** touch `sales_imports.source_file_name` (#474)
- Does **not** touch `records_processed`, `error_message`, or `metadata`
- Does **not** touch `activity_events` vocabulary (#512)
- Does **not** touch `insights` vocabulary (#515)
- Alone on main OK; timestamp after #515 (`20260930170000`)

## Verification

- `npm run typecheck` pass
- focused `tests/salesImportsImportTypeStatusLocalePin.test.ts` 3/3 pass
- `npm test` 679 pass / 0 fail / 7 cancelled (withTimeout baseline; includes
  the three new MISE-005DD static checks)
- pgTAP fixture committed (plan 18 from 18 assertion call sites); Docker/hosted
  pgTAP not run here

## Files

- `supabase/migrations/20260930180000_mise_005dd_sales_imports_import_type_status_locale_pin.sql`
- `supabase/tests/database/sales_imports_import_type_status_locale_pin.test.sql`
- `tests/salesImportsImportTypeStatusLocalePin.test.ts`
- `docs/automation-reports/2026-09-30-sales-imports-import-type-status-locale-pin.md`
