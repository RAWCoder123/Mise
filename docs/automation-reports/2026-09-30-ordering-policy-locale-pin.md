# MISE-005DF: pin ordering_policy CHECKs to COLLATE C

Date: 2026-09-30
Branch: `cursor/mise-ordering-policy-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Replace the bare-IN `ordering_policy` allowlists on both operational-controls
tables with the exact-token contract plus ASCII shape under COLLATE `"C"`:

```sql
ordering_policy in ('off', 'draft_only')
and ordering_policy collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
```

Applied to:

- `public.system_operational_controls.ordering_policy`
- `public.restaurant_operational_controls.ordering_policy`

## Writer vocabulary

Confirmed ASCII mint (provider kill-switch migration, purchase-approval
authority gates, pilot operational controls, invite-only admission):

- `off` — supplier-order drafting disabled
- `draft_only` — manager-controlled draft generation permitted when
  `order_drafting_enabled` is also true

Exact-token allowlist is preserved; this tip adds the COLLATE C ASCII
shape gate alongside it.

## Why

MISE-005A proved locale drift on this cluster. Open sibling pin #517 covers
`system_operational_controls.operational_mode`, but leaves `ordering_policy`
on both control tables on bare IN only. Without a dedicated COLLATE C shape
CHECK, dump/restore under LC_CTYPE drift can accept ordering-policy
vocabulary bytes the restored C-locale path would refuse — or the reverse —
breaking supplier-order authority across restore.

## Scope

- CHECK-only on both `ordering_policy` columns
- Does **not** rewrite `order_drafting_policy_check` coupling constraints
- Does **not** touch `operational_mode` (#517)
- Does **not** rewrite `service_set_system_operational_mode` (#434)
- Does **not** touch pilot control writers
- Does **not** touch `purchase_orders.status` or other bare-IN vocabularies
- Alone on main OK; timestamp after #517 (`20260930190000`)

## Verification

- `npm run typecheck` pass
- focused `tests/orderingPolicyLocalePin.test.ts` 3/3 pass
- `npm test` 679 pass / 0 fail / 7 cancelled (inherited cancelledByParent noise; new
  MISE-005DF cases pass)
- pgTAP fixture committed (plan 13 from 13 assertion call sites); Docker/hosted
  pgTAP not run here

## Files

- `supabase/migrations/20260930200000_mise_005df_ordering_policy_locale_pin.sql`
- `supabase/tests/database/ordering_policy_locale_pin.test.sql`
- `tests/orderingPolicyLocalePin.test.ts`
- `docs/automation-reports/2026-09-30-ordering-policy-locale-pin.md`
