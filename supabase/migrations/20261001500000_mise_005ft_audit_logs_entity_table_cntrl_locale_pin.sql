-- MISE-005FT: pin public.audit_logs.entity_table CHECK to reject
-- control characters under COLLATE "C".
--
-- audit_logs.entity_table was declared as NOT NULL text with no length or
-- control-character gate (restaurant_ops_backbone). The authoritative
-- edge writer private.service_record_edge_audit_log already rejects
-- entity_table values whose length is outside 1..120
-- (reinforce_tenant_isolation) before insert; other SECURITY DEFINER
-- paths insert fixed single-line table-name labels such as
-- mise_actions, purchase_recommendations, supplier_orders, and
-- inventory_items. There was still no table-level control gate.
-- Bare POSIX [[:cntrl:]] follows database LC_CTYPE; this cluster runs
-- libc en_US.UTF-8. MISE-005A proved locale drift on this cluster;
-- sibling tips re-pin text CHECKs with `collate "C" !~ '[[:cntrl:]]'`.
--
-- entity_table is a durable single-line system table-name label on the
-- append-only audit ledger (snake_case identifiers). It is not operator
-- free-form prose and must not accept LF/TAB/CR/NUL. If LC_CTYPE drifted
-- under a bare (or missing) cntrl gate, dump/restore could accept
-- entity_table bytes a restored C-locale path would refuse — or the
-- reverse — breaking audit ledger continuity across restore.
--
-- Scope:
--   - Attach audit_logs_entity_table_check as
--     length(trim(entity_table)) 1..120 PLUS ASCII control rejection
--     under COLLATE "C" (matches service_record_edge_audit_log 120
--     bound; length(trim) also rejects whitespace-only values)
-- Does NOT rewrite service_record_edge_audit_log, SECURITY DEFINER
-- audit writers, action (#583), entity_id (uuid), metadata, or sibling
-- cntrl tips (#582 sales_imports.error_message, #581 activity
-- error_message, etc.).
-- Timestamp after MISE-005FS (#583).

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.audit_logs'::regclass
      and con.contype = 'c'
      and (
        con.conname = 'audit_logs_entity_table_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%entity_table%'
          and (
            pg_get_constraintdef(con.oid) ilike '%length%trim%entity_table%'
            or pg_get_constraintdef(con.oid) ilike '%[[:cntrl:]]%'
          )
          and pg_get_constraintdef(con.oid) not ilike '%action%'
          and pg_get_constraintdef(con.oid) not ilike '%entity_id%'
          and pg_get_constraintdef(con.oid) not ilike '%metadata%'
          and pg_get_constraintdef(con.oid) not ilike '%actor_user_id%'
          and pg_get_constraintdef(con.oid) not ilike '%restaurant_id%'
        )
      )
    order by con.conname
  loop
    execute format(
      'alter table public.audit_logs drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table public.audit_logs
  drop constraint if exists audit_logs_entity_table_check;

alter table public.audit_logs
  add constraint audit_logs_entity_table_check check (
    length(trim(entity_table)) between 1 and 120
    and entity_table collate "C" !~ '[[:cntrl:]]'
  );

comment on constraint audit_logs_entity_table_check on public.audit_logs is
  'MISE-005FT: audit_logs entity_table length(trim) 1..120 plus ASCII control rejection under COLLATE "C".';
