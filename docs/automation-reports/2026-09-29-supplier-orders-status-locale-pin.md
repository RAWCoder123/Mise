# MISE-005CK: pin supplier_orders.status CHECK to COLLATE C

Date: 2026-09-29
Branch: `cursor/mise-supplier-orders-status-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Replace the bare-IN `supplier_orders.status` allowlist (`draft` / `sent` /
`completed`) with the exact-token contract plus ASCII shape under COLLATE `"C"`:

```sql
status in ('draft', 'sent', 'completed')
and status collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
```

## Writer vocabulary

Confirmed ASCII mint (`types/mise.ts` `SupplierOrderStatus`, domain/demo
writers, supplier-send / receive SQL paths):

- `draft` — unsent purchase/order draft awaiting approval or send
- `sent` — supplier-facing send completed (or marked sent)
- `completed` — order fully received / closed

Exact-token allowlist is preserved; this tip adds the COLLATE C ASCII shape
gate alongside it.

## Why

MISE-005A proved locale drift on this cluster. Open sibling pins cover
`recalculation_runs.status` (#496) and `inventory_count_sessions.status`
(#495), but leave `supplier_orders.status` on bare IN only. Without a
dedicated COLLATE C shape CHECK, dump/restore under LC_CTYPE drift can accept
order-lifecycle bytes the restored C-locale path would refuse — or the
reverse — breaking send/receive continuity across restore.

## Scope

- CHECK-only on `public.supplier_orders.status`
- Does **not** rewrite supplier-send / purchase-approval writers
- Does **not** touch operational_values / purchase_authority / send_content /
  email_delivery CHECKs
- Does **not** touch `restaurant_tasks.status`
- Does **not** touch `recalculation_runs.status` (#496)
- Does **not** touch `inventory_count_sessions.status` (#495)
- Alone on main OK; timestamp after #496 (`20260929230000`)

## Verification

- `npm run typecheck` pass
- focused `tests/supplierOrdersStatusLocalePin.test.ts` 3/3 pass
- `npm test` 679 pass / 0 fail / 7 cancelled (withTimeout baseline; includes
  the three new MISE-005CK static checks)
- pgTAP fixture committed (plan 11 from 11 assertion call sites); Docker/hosted
  pgTAP not run here

## Files

- `supabase/migrations/20260929230000_mise_005ck_supplier_orders_status_locale_pin.sql`
- `supabase/tests/database/supplier_orders_status_locale_pin.test.sql`
- `tests/supplierOrdersStatusLocalePin.test.ts`
- `docs/automation-reports/2026-09-29-supplier-orders-status-locale-pin.md`
