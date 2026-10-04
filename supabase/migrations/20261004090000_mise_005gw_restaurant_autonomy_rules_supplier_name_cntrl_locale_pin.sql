-- MISE-005GW: pin public.restaurant_autonomy_rules.supplier_name CHECK to
-- reject control characters under COLLATE "C" and lock the autonomy-rule
-- supplier-name length bound.
--
-- restaurant_autonomy_rules.supplier_name was declared as nullable text with
-- no CHECK on the operational-backend foundation table. MISE-003C added
-- supplier_id and restaurant_autonomy_rules_supplier_scope_check
-- ((supplier_name is null) = (supplier_id is null)), but there is still no
-- control-character gate and no length bound on supplier_name itself. Writers
-- already normalize via nullif(left(trim(...), 160), '') (foundation) or copy
-- suppliers.display_name (MISE-003C upsert; display_name is itself 1..160).
-- Bare POSIX [[:cntrl:]] follows database LC_CTYPE; this cluster runs libc
-- en_US.UTF-8. MISE-005A proved locale drift on this cluster; sibling tips
-- re-pin text CHECKs with `collate "C" !~ '[[:cntrl:]]'`.
--
-- supplier_name is a nullable single-line scoped supplier display label on an
-- autonomy rule (operator-facing snapshot alongside durable supplier_id). It
-- is not free-form multiline prose and must not accept LF/TAB/CR/NUL. If
-- LC_CTYPE drifted under a bare (or missing) cntrl gate, dump/restore could
-- accept supplier_name bytes a restored C-locale path would refuse — or the
-- reverse — breaking autonomy-rule supplier-scope continuity across restore.
--
-- Scope:
--   - Attach restaurant_autonomy_rules_supplier_name_check as null OR
--     length(trim(supplier_name)) between 1 and 160 PLUS ASCII control
--     rejection under COLLATE "C" (matches inventory_items.supplier_name
--     1..160 bound on main)
--   - Dedicated CHECK so this tip stays alone-OK versus
--     restaurant_autonomy_rules_supplier_scope_check (left intact; protect
--     drop with not ilike '%supplier_id%'), execute_guard,
--     operational_category, communication_type, and spend_limit bounds
-- Does NOT rewrite upsert_restaurant_autonomy_rule, durable supplier_id
-- authority (MISE-003C), supplier_scope_check, execute_guard,
-- operational_category, or communication_type.
-- Timestamp after MISE-005GV (#612).

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
        con.conname = 'restaurant_autonomy_rules_supplier_name_check'
        or (
          pg_get_constraintdef(con.oid) ~* '\ysupplier_name\y'
          and (
            pg_get_constraintdef(con.oid) ilike '%length%trim%supplier_name%'
            or pg_get_constraintdef(con.oid) ilike '%length(supplier_name)%'
            or pg_get_constraintdef(con.oid) ilike '%[[:cntrl:]]%'
          )
          and pg_get_constraintdef(con.oid) not ilike '%supplier_id%'
          and pg_get_constraintdef(con.oid) not ilike '%execute%'
          and pg_get_constraintdef(con.oid) not ilike '%maximum_autonomy%'
          and pg_get_constraintdef(con.oid) not ilike '%operational_category%'
          and pg_get_constraintdef(con.oid) not ilike '%communication_type%'
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
  drop constraint if exists restaurant_autonomy_rules_supplier_name_check;

alter table public.restaurant_autonomy_rules
  add constraint restaurant_autonomy_rules_supplier_name_check check (
    supplier_name is null
    or (
      length(trim(supplier_name)) between 1 and 160
      and supplier_name collate "C" !~ '[[:cntrl:]]'
    )
  );

comment on constraint restaurant_autonomy_rules_supplier_name_check
  on public.restaurant_autonomy_rules is
  'MISE-005GW: restaurant_autonomy_rules supplier_name null or length(trim) 1..160 plus ASCII control rejection under COLLATE "C".';
