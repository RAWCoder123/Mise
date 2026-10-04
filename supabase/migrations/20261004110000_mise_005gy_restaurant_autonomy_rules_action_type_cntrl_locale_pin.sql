-- MISE-005GY: pin public.restaurant_autonomy_rules.action_type CHECK to
-- reject control characters under COLLATE "C" and lock the autonomy-rule
-- action-type length bound.
--
-- restaurant_autonomy_rules.action_type was declared as NOT NULL text with
-- no CHECK on the operational-backend foundation table. Writers already
-- normalize via left(trim(...), 120) (foundation) /
-- pg_catalog.left(pg_catalog.btrim(...), 120) (MISE-003C upsert).
-- Bare POSIX [[:cntrl:]] follows database LC_CTYPE; this cluster runs libc
-- en_US.UTF-8. MISE-005A proved locale drift on this cluster; sibling tips
-- re-pin text CHECKs with `collate "C" !~ '[[:cntrl:]]'`.
--
-- action_type is a durable NOT NULL single-line action key on an autonomy
-- rule (for example send_supplier_order). It participates in scope_key and
-- is not free-form multiline prose; it must not accept LF/TAB/CR/NUL. If
-- LC_CTYPE drifted under a bare (or missing) cntrl gate, dump/restore could
-- accept action_type bytes a restored C-locale path would refuse — or the
-- reverse — breaking autonomy-rule scope continuity across restore.
--
-- Scope:
--   - Attach restaurant_autonomy_rules_action_type_check as
--     length(trim(action_type)) between 1 and 120 PLUS ASCII control
--     rejection under COLLATE "C" (matches writer left(trim(...), 120)).
--     Column is NOT NULL; no null OR branch.
--   - Dedicated CHECK so this tip stays alone-OK versus
--     restaurant_autonomy_rules_communication_type_check (#614; protect
--     drop with not ilike '%communication_type%'),
--     restaurant_autonomy_rules_supplier_name_check (#613; protect with
--     not ilike '%supplier_name%'), supplier_scope_check (protect with
--     not ilike '%supplier_id%'), execute_guard (protect with
--     not ilike '%execute%' / '%maximum_autonomy%' even though that sibling
--     CHECK text also mentions action_type), operational_category, and
--     spend_limit bounds
-- Does NOT rewrite upsert_restaurant_autonomy_rule, durable supplier_id
-- authority (MISE-003C), communication_type_check, supplier_name_check,
-- supplier_scope_check, execute_guard, operational_category, or spend_limit.
-- Timestamp after MISE-005GX (#614).

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.restaurant_autonomy_rules'::regclass
      and con.contype = 'c'
      and (
        con.conname = 'restaurant_autonomy_rules_action_type_check'
        or (
          pg_get_constraintdef(con.oid) ~* '\yaction_type\y'
          and (
            pg_get_constraintdef(con.oid) ilike '%length%trim%action_type%'
            or pg_get_constraintdef(con.oid) ilike '%length(action_type)%'
            or pg_get_constraintdef(con.oid) ilike '%[[:cntrl:]]%'
          )
          and pg_get_constraintdef(con.oid) not ilike '%communication_type%'
          and pg_get_constraintdef(con.oid) not ilike '%supplier_name%'
          and pg_get_constraintdef(con.oid) not ilike '%supplier_id%'
          and pg_get_constraintdef(con.oid) not ilike '%execute%'
          and pg_get_constraintdef(con.oid) not ilike '%maximum_autonomy%'
          and pg_get_constraintdef(con.oid) not ilike '%operational_category%'
          and pg_get_constraintdef(con.oid) not ilike '%spend_limit%'
        )
      )
    order by con.conname
  loop
    execute format(
      'alter table public.restaurant_autonomy_rules drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table public.restaurant_autonomy_rules
  drop constraint if exists restaurant_autonomy_rules_action_type_check;

alter table public.restaurant_autonomy_rules
  add constraint restaurant_autonomy_rules_action_type_check check (
    length(trim(action_type)) between 1 and 120
    and action_type collate "C" !~ '[[:cntrl:]]'
  );

comment on constraint restaurant_autonomy_rules_action_type_check
  on public.restaurant_autonomy_rules is
  'MISE-005GY: restaurant_autonomy_rules action_type length(trim) 1..120 plus ASCII control rejection under COLLATE "C".';
