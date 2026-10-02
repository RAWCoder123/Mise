-- MISE-005FS: pin public.audit_logs.action CHECK to reject
-- control characters under COLLATE "C".
--
-- audit_logs.action was declared as NOT NULL text with no length or
-- control-character gate (restaurant_ops_backbone). The authoritative
-- edge writer private.service_record_edge_audit_log already rejects
-- actions whose length is outside 1..120 (reinforce_tenant_isolation)
-- before insert; other SECURITY DEFINER paths insert fixed single-line
-- action labels such as square_sync_completed, recommendation_approved,
-- and supplier_order_sent. There was still no table-level control gate.
-- Bare POSIX [[:cntrl:]] follows database LC_CTYPE; this cluster runs
-- libc en_US.UTF-8. MISE-005A proved locale drift on this cluster;
-- sibling tips re-pin text CHECKs with `collate "C" !~ '[[:cntrl:]]'`.
--
-- action is a durable single-line system audit verb on the append-only
-- audit ledger (snake_case / dotted labels). It is not operator free-form
-- prose and must not accept LF/TAB/CR/NUL. If LC_CTYPE drifted under a
-- bare (or missing) cntrl gate, dump/restore could accept action bytes a
-- restored C-locale path would refuse — or the reverse — breaking audit
-- ledger continuity across restore.
--
-- Scope:
--   - Attach audit_logs_action_check as
--     length(trim(action)) 1..120 PLUS ASCII control rejection under
--     COLLATE "C" (matches service_record_edge_audit_log 120 bound;
--     length(trim) also rejects whitespace-only values)
-- Does NOT rewrite service_record_edge_audit_log, SECURITY DEFINER audit
-- writers, entity_table, entity_id (uuid), metadata, or sibling cntrl tips
-- (#582 sales_imports.error_message, #581 activity error_message, etc.).
-- Timestamp after MISE-005FR (#582).

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
        con.conname = 'audit_logs_action_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%action%'
          and (
            pg_get_constraintdef(con.oid) ilike '%length%trim%action%'
            or pg_get_constraintdef(con.oid) ilike '%[[:cntrl:]]%'
          )
          and pg_get_constraintdef(con.oid) not ilike '%entity_table%'
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
  drop constraint if exists audit_logs_action_check;

alter table public.audit_logs
  add constraint audit_logs_action_check check (
    length(trim(action)) between 1 and 120
    and action collate "C" !~ '[[:cntrl:]]'
  );

comment on constraint audit_logs_action_check on public.audit_logs is
  'MISE-005FS: audit_logs action length(trim) 1..120 plus ASCII control rejection under COLLATE "C".';
