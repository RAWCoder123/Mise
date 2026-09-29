-- MISE-005CX: pin mise_actions.action_type, execution_mode, and status
-- CHECKs to COLLATE "C", preserving the exact-token allowlists.
--
-- mise_actions stores action-lifecycle vocabulary under bare IN allowlists
-- from operational_backend_foundation:
--   action_type in (
--     'create_internal_task', 'recalculate_forecast',
--     'update_prep_recommendation', 'schedule_inventory_count',
--     'remind_employee', 'flag_menu_item_internally',
--     'prepare_supplier_order_draft', 'send_supplier_order',
--     'change_schedule', 'contact_external_party',
--     'modify_menu_availability', 'change_price',
--     'send_staff_communication', 'send_supplier_communication',
--     'issue_refund_or_credit', 'change_permissions_or_rules',
--     'prepare_inventory_adjustment', 'measure_outcome'
--   )
--   execution_mode in ('observe', 'recommend', 'prepare', 'execute')
--   status in (
--     'prepared', 'waiting_for_approval', 'approved', 'rejected',
--     'executing', 'executed', 'failed', 'cancelled', 'reversed',
--     'unverified'
--   )
-- Those allowlists are exact string equality and carry no dedicated ASCII
-- shape gate under COLLATE "C". Writers mint durable ASCII tokens only
-- (supplier-order sync uses 'send_supplier_order' / 'prepare' /
-- 'executed' / 'failed' / 'unverified'; approve_mise_action uses
-- 'approved' / 'rejected').
--
-- action_type gates autonomy-rule execute guards, activity routing, and
-- supplier-send action lookup. execution_mode gates observe/recommend/
-- prepare/execute authority. status gates approval, execution, and
-- failure lifecycle. POSIX character classes follow database LC_CTYPE.
-- This cluster runs libc en_US.UTF-8. MISE-005A proved locale drift on
-- this cluster; open sibling pins cover mise_actions.idempotency_key
-- (#457) and error_code shape (#441/#449), leaving action_type /
-- execution_mode / status on bare IN.
--
-- If LC_CTYPE drifted under a bare-IN action-lifecycle CHECK,
-- dump/restore could accept action-type / execution-mode / status bytes
-- the restored C-locale path (and sibling machine-identity gates) would
-- refuse — or the reverse — breaking action lifecycle across restore.
--
-- Scope:
--   - Replace mise_actions_action_type_check with exact-token allowlist
--     PLUS ASCII shape under COLLATE "C"
--   - Replace mise_actions_execution_mode_check with exact-token
--     allowlist PLUS ASCII shape under COLLATE "C"
--   - Replace mise_actions_status_check with exact-token allowlist PLUS
--     ASCII shape under COLLATE "C"
-- Does NOT rewrite supplier-order / approve / fail writers, idempotency_key
-- (#457), error_code (#441/#449), autonomy_level, evidence/result bounds,
-- action_outcomes, restaurant_memories, activity_events, or
-- operational_issues allowlists.
-- Timestamp after MISE-005CW (#509).

alter table public.mise_actions
  drop constraint if exists mise_actions_action_type_check;

alter table public.mise_actions
  add constraint mise_actions_action_type_check
  check (
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
  );

comment on constraint mise_actions_action_type_check
  on public.mise_actions is
  'MISE-005CX: exact action_type allowlist plus ASCII shape under COLLATE "C". Mise action type.';

comment on column public.mise_actions.action_type is
  'Mise action type. Allowed values: create_internal_task, recalculate_forecast, update_prep_recommendation, schedule_inventory_count, remind_employee, flag_menu_item_internally, prepare_supplier_order_draft, send_supplier_order, change_schedule, contact_external_party, modify_menu_availability, change_price, send_staff_communication, send_supplier_communication, issue_refund_or_credit, change_permissions_or_rules, prepare_inventory_adjustment, measure_outcome under COLLATE "C".';

alter table public.mise_actions
  drop constraint if exists mise_actions_execution_mode_check;

alter table public.mise_actions
  add constraint mise_actions_execution_mode_check
  check (
    execution_mode in ('observe', 'recommend', 'prepare', 'execute')
    and execution_mode collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint mise_actions_execution_mode_check
  on public.mise_actions is
  'MISE-005CX: exact observe/recommend/prepare/execute allowlist plus ASCII shape under COLLATE "C". Mise action execution mode.';

comment on column public.mise_actions.execution_mode is
  'Mise action execution mode. Allowed values: observe, recommend, prepare, execute under COLLATE "C".';

alter table public.mise_actions
  drop constraint if exists mise_actions_status_check;

alter table public.mise_actions
  add constraint mise_actions_status_check
  check (
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
  );

comment on constraint mise_actions_status_check
  on public.mise_actions is
  'MISE-005CX: exact prepared/waiting_for_approval/approved/rejected/executing/executed/failed/cancelled/reversed/unverified allowlist plus ASCII shape under COLLATE "C". Mise action status.';

comment on column public.mise_actions.status is
  'Mise action status. Allowed values: prepared, waiting_for_approval, approved, rejected, executing, executed, failed, cancelled, reversed, unverified under COLLATE "C".';
