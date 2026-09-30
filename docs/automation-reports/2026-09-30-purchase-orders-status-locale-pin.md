# MISE-005DG: pin purchase_orders.status CHECK to COLLATE C

Date: 2026-09-30
Branch: `cursor/mise-purchase-orders-status-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Replace the bare-IN `purchase_orders.status` allowlist (`draft` / `submitted` /
`received` / `cancelled`) with the exact-token contract plus ASCII shape under
COLLATE `"C"`:

```sql
status in ('draft', 'submitted', 'received', 'cancelled')
and status collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
```

## Writer vocabulary

Confirmed ASCII mint (`types/mise.ts` `PurchaseOrderStatus`, restaurant-ops
backbone create-table allowlist, demo/tenant fixtures):

- `draft` — unsent purchase order awaiting submit
- `submitted` — order submitted to supplier / outbound workflow
- `received` — delivery received and closed
- `cancelled` — order cancelled without receiving

Exact-token allowlist is preserved; this tip adds the COLLATE C ASCII shape
gate alongside it.

## Why

MISE-005A proved locale drift on this cluster. Open sibling pin #497 covers
`supplier_orders.status` (`draft` / `sent` / `completed`), but leaves
`purchase_orders.status` on bare IN only. Without a dedicated COLLATE C shape
CHECK, dump/restore under LC_CTYPE drift can accept purchase-order lifecycle
bytes the restored C-locale path would refuse — or the reverse — breaking
purchase-order continuity across restore.

## Scope

- CHECK-only on `public.purchase_orders.status`
- Does **not** rewrite purchase-order / supplier-order writers
- Does **not** touch `purchase_orders_operational_values_check`
- Does **not** touch `supplier_orders.status` (#497)
- Does **not** touch `ordering_policy` (#518)
- Alone on main OK; timestamp after #518 (`20260930210000`)

## Verification

- `npm run typecheck` pass
- focused `tests/purchaseOrdersStatusLocalePin.test.ts` 3/3 pass
- `npm test` 679 pass / 0 fail / 7 cancelled (inherited cancelledByParent noise; new
  MISE-005DG cases pass)
- pgTAP fixture committed (plan 12 from 12 assertion call sites); Docker/hosted
  pgTAP not run here

## Files

- `supabase/migrations/20260930210000_mise_005dg_purchase_orders_status_locale_pin.sql`
- `supabase/tests/database/purchase_orders_status_locale_pin.test.sql`
- `tests/purchaseOrdersStatusLocalePin.test.ts`
- `docs/automation-reports/2026-09-30-purchase-orders-status-locale-pin.md`
