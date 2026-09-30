# MISE-005DA: pin supplier_order_confirmations.confirmation_status CHECK to COLLATE C

Date: 2026-09-30
Branch: `cursor/mise-supplier-confirmation-status-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Replace the bare-IN `supplier_order_confirmations.confirmation_status`
allowlist (`acknowledged` / `changed` / `rejected` / `unverified`) with the
exact-token contract plus ASCII shape under COLLATE `"C"`:

```sql
confirmation_status in ('acknowledged', 'changed', 'rejected', 'unverified')
and confirmation_status collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
```

## Writer vocabulary

Confirmed ASCII mint (`service_record_supplier_confirmation`
preflight allowlist):

- `acknowledged` — supplier accepted the order as sent
- `changed` — supplier confirmed with material changes
- `rejected` — supplier refused the order
- `unverified` — confirmation received but could not be verified

Exact-token allowlist is preserved; this tip adds the COLLATE C ASCII shape
gate alongside it.

## Why

MISE-005A proved locale drift on this cluster. Open sibling pins cover
`supplier_order_confirmations.idempotency_key` (#459) and
`supplier_orders.status` (#497), but leave `confirmation_status` on bare IN
only. Without a dedicated COLLATE C shape CHECK, dump/restore under LC_CTYPE
drift can accept confirmation-lifecycle bytes the restored C-locale path
would refuse — or the reverse — breaking confirmation continuity across
restore.

## Scope

- CHECK-only on `public.supplier_order_confirmations.confirmation_status`
- Does **not** rewrite `service_record_supplier_confirmation` writers
- Does **not** touch `confirmation_reference` / `source` / `normalized_details`
- Does **not** touch `idempotency_key` (#459)
- Does **not** touch `supplier_orders.status` (#497)
- Does **not** touch `supplier_deliveries.status`
- Does **not** touch `activity_events` vocabulary (#512)
- Alone on main OK; timestamp after #512 (`20260930140000`)

## Verification

- `npm run typecheck` pass
- focused `tests/supplierConfirmationStatusLocalePin.test.ts` 3/3 pass
- `npm test` 679 pass / 0 fail / 7 cancelled (withTimeout baseline; includes
  the three new MISE-005DA static checks)
- pgTAP fixture committed (plan 12 from 12 assertion call sites); Docker/hosted
  pgTAP not run here

## Files

- `supabase/migrations/20260930150000_mise_005da_supplier_confirmation_status_locale_pin.sql`
- `supabase/tests/database/supplier_confirmation_status_locale_pin.test.sql`
- `tests/supplierConfirmationStatusLocalePin.test.ts`
- `docs/automation-reports/2026-09-30-supplier-confirmation-status-locale-pin.md`
