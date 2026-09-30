# MISE-005DB: pin supplier_deliveries.status CHECK to COLLATE C

Date: 2026-09-30
Branch: `cursor/mise-supplier-deliveries-status-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Replace the bare-IN `supplier_deliveries.status` allowlist
(`unverified` / `partially_received` / `received` / `discrepancy` /
`failed`) with the exact-token contract plus ASCII shape under COLLATE
`"C"`:

```sql
status in ('unverified', 'partially_received', 'received', 'discrepancy', 'failed')
and status collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
```

## Writer vocabulary

Confirmed ASCII mint (`service_receive_supplier_order` normalized_status
and table default):

- `unverified` — delivery row created before verification completes
- `partially_received` — some ordered lines still outstanding
- `received` — clean full receive
- `discrepancy` — shortage, damage, or substitution recorded
- `failed` — receive attempt could not be completed

Exact-token allowlist is preserved; this tip adds the COLLATE C ASCII shape
gate alongside it.

## Why

MISE-005A proved locale drift on this cluster. Open sibling pins cover
`supplier_deliveries` identity (#458) and `supplier_orders.status` (#497),
but leave `supplier_deliveries.status` on bare IN only. Without a dedicated
COLLATE C shape CHECK, dump/restore under LC_CTYPE drift can accept
receiving-lifecycle bytes the restored C-locale path would refuse — or the
reverse — breaking delivery continuity across restore.

## Scope

- CHECK-only on `public.supplier_deliveries.status`
- Does **not** rewrite `service_receive_supplier_order` writers
- Does **not** touch delivery identity CHECKs (#458)
- Does **not** touch `supplier_orders.status` (#497)
- Does **not** touch `supplier_order_confirmations.confirmation_status` (#513)
- Does **not** touch delivery `notes` free-form fields
- Does **not** touch `activity_events` vocabulary (#512)
- Alone on main OK; timestamp after #513 (`20260930150000`)

## Verification

- `npm run typecheck` pass
- focused `tests/supplierDeliveriesStatusLocalePin.test.ts` 3/3 pass
- `npm test` 679 pass / 0 fail / 7 cancelled (withTimeout baseline; includes
  the three new MISE-005DB static checks)
- pgTAP fixture committed (plan 13 from 13 assertion call sites); Docker/hosted
  pgTAP not run here

## Files

- `supabase/migrations/20260930160000_mise_005db_supplier_deliveries_status_locale_pin.sql`
- `supabase/tests/database/supplier_deliveries_status_locale_pin.test.sql`
- `tests/supplierDeliveriesStatusLocalePin.test.ts`
- `docs/automation-reports/2026-09-30-supplier-deliveries-status-locale-pin.md`
