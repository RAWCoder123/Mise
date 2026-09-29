-- MISE-005CX: mise_actions.action_type, execution_mode, and status CHECKs
-- must keep the exact-token allowlists and pin ASCII shape under COLLATE
-- "C" so dump/restore cannot accept an action-lifecycle identity the
-- restored C-locale gate would refuse.
begin;
select plan(56);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.mise_actions'::regclass
      and conname = 'mise_actions_action_type_check'
  ),
  'mise_actions_action_type_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.mise_actions'::regclass
      and conname = 'mise_actions_action_type_check'
  ),
  'action_type in \(''create_internal_task'', ''recalculate_forecast'', ''update_prep_recommendation'', ''schedule_inventory_count'', ''remind_employee'', ''flag_menu_item_internally'', ''prepare_supplier_order_draft'', ''send_supplier_order'', ''change_schedule'', ''contact_external_party'', ''modify_menu_availability'', ''change_price'', ''send_staff_communication'', ''send_supplier_communication'', ''issue_refund_or_credit'', ''change_permissions_or_rules'', ''prepare_inventory_adjustment'', ''measure_outcome''\)',
  'mise_actions action_type CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.mise_actions'::regclass
      and conname = 'mise_actions_action_type_check'
  ),
  'action_type collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'mise_actions action_type CHECK uses COLLATE C'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.mise_actions'::regclass
      and conname = 'mise_actions_execution_mode_check'
  ),
  'mise_actions_execution_mode_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.mise_actions'::regclass
      and conname = 'mise_actions_execution_mode_check'
  ),
  'execution_mode in \(''observe'', ''recommend'', ''prepare'', ''execute''\)',
  'mise_actions execution_mode CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.mise_actions'::regclass
      and conname = 'mise_actions_execution_mode_check'
  ),
  'execution_mode collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'mise_actions execution_mode CHECK uses COLLATE C'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.mise_actions'::regclass
      and conname = 'mise_actions_status_check'
  ),
  'mise_actions_status_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.mise_actions'::regclass
      and conname = 'mise_actions_status_check'
  ),
  'status in \(''prepared'', ''waiting_for_approval'', ''approved'', ''rejected'', ''executing'', ''executed'', ''failed'', ''cancelled'', ''reversed'', ''unverified''\)',
  'mise_actions status CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.mise_actions'::regclass
      and conname = 'mise_actions_status_check'
  ),
  'status collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'mise_actions status CHECK uses COLLATE C'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('create_internal_task' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token create_internal_task matches under COLLATE C'
);

select is(
  ('recalculate_forecast' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token recalculate_forecast matches under COLLATE C'
);

select is(
  ('update_prep_recommendation' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token update_prep_recommendation matches under COLLATE C'
);

select is(
  ('schedule_inventory_count' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token schedule_inventory_count matches under COLLATE C'
);

select is(
  ('remind_employee' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token remind_employee matches under COLLATE C'
);

select is(
  ('flag_menu_item_internally' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token flag_menu_item_internally matches under COLLATE C'
);

select is(
  ('prepare_supplier_order_draft' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token prepare_supplier_order_draft matches under COLLATE C'
);

select is(
  ('send_supplier_order' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token send_supplier_order matches under COLLATE C'
);

select is(
  ('change_schedule' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token change_schedule matches under COLLATE C'
);

select is(
  ('contact_external_party' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token contact_external_party matches under COLLATE C'
);

select is(
  ('modify_menu_availability' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token modify_menu_availability matches under COLLATE C'
);

select is(
  ('change_price' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token change_price matches under COLLATE C'
);

select is(
  ('send_staff_communication' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token send_staff_communication matches under COLLATE C'
);

select is(
  ('send_supplier_communication' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token send_supplier_communication matches under COLLATE C'
);

select is(
  ('issue_refund_or_credit' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token issue_refund_or_credit matches under COLLATE C'
);

select is(
  ('change_permissions_or_rules' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token change_permissions_or_rules matches under COLLATE C'
);

select is(
  ('prepare_inventory_adjustment' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token prepare_inventory_adjustment matches under COLLATE C'
);

select is(
  ('measure_outcome' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token measure_outcome matches under COLLATE C'
);

select is(
  ('send supplier order' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced action_type token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty action_type token is rejected under COLLATE C'
);

select is(
  ('send_supplier_order!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated action_type token is rejected under COLLATE C'
);

select is(
  (E'send_supplier_ord\u00ebr' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII action_type token is rejected under COLLATE C'
);

select is(
  ('create_internal_task' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('recalculate_forecast' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('update_prep_recommendation' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('schedule_inventory_count' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('remind_employee' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('flag_menu_item_internally' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('prepare_supplier_order_draft' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('send_supplier_order' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('change_schedule' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('contact_external_party' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('modify_menu_availability' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('change_price' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('send_staff_communication' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('send_supplier_communication' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('issue_refund_or_credit' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('change_permissions_or_rules' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('prepare_inventory_adjustment' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('measure_outcome' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted action_type tokens match under COLLATE C'
);

select is(
  ('observe' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token observe matches under COLLATE C'
);

select is(
  ('recommend' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token recommend matches under COLLATE C'
);

select is(
  ('prepare' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token prepare matches under COLLATE C'
);

select is(
  ('execute' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token execute matches under COLLATE C'
);

select is(
  ('prep are' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced execution_mode token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty execution_mode token is rejected under COLLATE C'
);

select is(
  ('prepare!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated execution_mode token is rejected under COLLATE C'
);

select is(
  (E'prep\u00e0re' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII execution_mode token is rejected under COLLATE C'
);

select is(
  ('observe' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('recommend' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('prepare' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('execute' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted execution_mode tokens match under COLLATE C'
);

select is(
  ('prepared' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token prepared matches under COLLATE C'
);

select is(
  ('waiting_for_approval' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token waiting_for_approval matches under COLLATE C'
);

select is(
  ('approved' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token approved matches under COLLATE C'
);

select is(
  ('rejected' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token rejected matches under COLLATE C'
);

select is(
  ('executing' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token executing matches under COLLATE C'
);

select is(
  ('executed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token executed matches under COLLATE C'
);

select is(
  ('failed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token failed matches under COLLATE C'
);

select is(
  ('cancelled' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token cancelled matches under COLLATE C'
);

select is(
  ('reversed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token reversed matches under COLLATE C'
);

select is(
  ('unverified' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token unverified matches under COLLATE C'
);

select is(
  ('waiting for approval' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced status token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty status token is rejected under COLLATE C'
);

select is(
  ('approved!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated status token is rejected under COLLATE C'
);

select is(
  (E'appr\u00f6ved' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII status token is rejected under COLLATE C'
);

select is(
  ('prepared' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('waiting_for_approval' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('approved' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('rejected' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('executing' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('executed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('failed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('cancelled' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('reversed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('unverified' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted status tokens match under COLLATE C'
);

select * from finish();
rollback;
