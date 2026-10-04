-- MISE-005GX: pin public.restaurant_autonomy_rules.communication_type CHECK to
-- reject control characters under COLLATE "C" and lock the autonomy-rule
-- communication-type length bound.
--
-- restaurant_autonomy_rules.communication_type was declared as nullable text
-- with no CHECK on the operational-backend foundation table. Writers already
-- normalize via nullif(left(trim(...), 80), '') (foundation) /
-- nullif(pg_catalog.left(pg_catalog.btrim(...), 80), '') (MISE-003C upsert).
-- Bare POSIX [[:cntrl:]] follows database LC_CTYPE; this cluster runs libc
-- en_US.UTF-8. MISE-005A proved locale drift on this cluster; sibling tips
-- re-pin text CHECKs with `collate "C" !~ '[[:cntrl:]]'`.
--
-- communication_type is a nullable single-line scoped channel label on an
-- autonomy rule (for example email). It is not free-form multiline prose and
-- must not accept LF/TAB/CR/NUL. If LC_CTYPE drifted under a bare (or missing)
-- cntrl gate, dump/restore could accept communication_type bytes a restored
-- C-locale path would refuse — or the reverse — breaking autonomy-rule scope
-- continuity across restore (scope_key includes communication_type).
--
-- Scope:
--   - Attach restaurant_autonomy_rules_communication_type_check as null OR
--     length(trim(communication_type)) between 1 and 80 PLUS ASCII control
--     rejection under COLLATE "C" (matches writer left(trim(...), 80) bound)
--   - Dedicated CHECK so this tip stays alone-OK versus
--     restaurant_autonomy_rules_supplier_name_check (#613; left intact; protect
--     drop with not ilike '%supplier_name%'), supplier_scope_check (protect
--     with not ilike '%supplier_id%'), execute_guard, operational_category,
--     and spend_limit bounds
-- Does NOT rewrite upsert_restaurant_autonomy_rule, durable supplier_id
-- authority (MISE-003C), supplier_name_check, supplier_scope_check,
-- execute_guard, operational_category, or spend_limit.
-- Timestamp after MISE-005GW (#613).

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
        con.conname = 'restaurant_autonomy_rules_communication_type_check'
        or (
          pg_get_constraintdef(con.oid) ~* '\ycommunication_type\y'
          and (
            pg_get_constraintdef(con.oid) ilike '%length%trim%communication_type%'
            or pg_get_constraintdef(con.oid) ilike '%length(communication_type)%'
            or pg_get_constraintdef(con.oid) ilike '%[[:cntrl:]]%'
          )
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
  drop constraint if exists restaurant_autonomy_rules_communication_type_check;

alter table public.restaurant_autonomy_rules
  add constraint restaurant_autonomy_rules_communication_type_check check (
    communication_type is null
    or (
      length(trim(communication_type)) between 1 and 80
      and communication_type collate "C" !~ '[[:cntrl:]]'
    )
  );

comment on constraint restaurant_autonomy_rules_communication_type_check
  on public.restaurant_autonomy_rules is
  'MISE-005GX: restaurant_autonomy_rules communication_type null or length(trim) 1..80 plus ASCII control rejection under COLLATE "C".';
