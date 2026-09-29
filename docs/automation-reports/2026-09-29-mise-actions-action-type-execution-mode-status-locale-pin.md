# MISE-005CX: pin mise_actions action_type / execution_mode / status CHECKs to COLLATE C

Date: 2026-09-29
Branch: `cursor/mise-actions-action-type-execution-mode-status-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Replace the bare-IN `mise_actions.action_type`, `execution_mode`, and `status`
allowlists with the exact-token contracts plus ASCII shape under COLLATE `"C"`:

```sql
action_type in (
  'create_internal_task',
  'recalculate_forecast',
  'update_prep_recommendation',
  'schedule_inventory_count',
  'remind_employee',
  'flag_menu_item_internally',
  'prepare_supplier_order_draft',
  'send_supplier_order',
  'change_schedule',
  'contact_external_party',
  'modify_menu_availability',
  'change_price',
  'send_staff_communication',
  'send_supplier_communication',
  'issue_refund_or_credit',
  'change_permissions_or_rules',
  'prepare_inventory_adjustment',
  'measure_outcome'
)
and action_type collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'

execution_mode in ('observe', 'recommend', 'prepare', 'execute')
and execution_mode collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'

status in (
  'prepared',
  'waiting_for_approval',
  'approved',
  'rejected',
  'executing',
  'executed',
  'failed',
  'cancelled',
  'reversed',
  'unverified'
)
and status collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
```

## Writer vocabulary

Confirmed ASCII mint (supplier-order sync / approve / failure paths in
operational_backend_foundation and later supplier-send integrity):

- `action_type`: `send_supplier_order` (active hosted mint); remaining
  allowlisted types are reserved autonomy vocabulary
- `execution_mode`: `prepare` on supplier-order draft mint
- `status`: `executed` / `failed` / `unverified` on send lifecycle;
  `approved` / `rejected` via `approve_mise_action`

Exact-token allowlists are preserved; this tip adds the COLLATE C ASCII shape
gate alongside each.

## Why

MISE-005A proved locale drift on this cluster. Open sibling pins cover
`mise_actions.idempotency_key` (#457) and `error_code` shape (#441/#449) and
deliberately left `action_type` / `execution_mode` / `status` on bare IN only.
Without a dedicated COLLATE C shape CHECK, dump/restore under LC_CTYPE drift
can accept action-lifecycle bytes the restored C-locale path would refuse — or
the reverse — breaking action type, execution mode, and status continuity
across restore.

## Scope

- CHECK-only on `public.mise_actions.action_type`, `execution_mode`, `status`
- Does **not** rewrite supplier-order / approve / fail writers
- Does **not** touch `idempotency_key` (#457) or `error_code` (#441/#449)
- Does **not** touch `action_outcomes`, `operational_issues`,
  `restaurant_memories`, or `activity_events` allowlists
- Alone on main OK; timestamp after #509 (`20260930120000`)

## Verification

- `npm run typecheck` pass
- focused `tests/miseActionsActionTypeExecutionModeStatusLocalePin.test.ts`
  3/3 pass
- `npm test` 679 pass / 0 fail / 7 cancelled (withTimeout baseline; includes
  the three new MISE-005CX static checks)
- pgTAP fixture committed (plan 56 from 56 assertion call sites); Docker/hosted
  pgTAP not run here

## Files

- `supabase/migrations/20260930120000_mise_005cx_mise_actions_action_type_execution_mode_status_locale_pin.sql`
- `supabase/tests/database/mise_actions_action_type_execution_mode_status_locale_pin.test.sql`
- `tests/miseActionsActionTypeExecutionModeStatusLocalePin.test.ts`
- `docs/automation-reports/2026-09-29-mise-actions-action-type-execution-mode-status-locale-pin.md`
