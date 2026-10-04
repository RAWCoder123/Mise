-- MISE-005HI: pin private.edge_function_security_events.action CHECK to
-- reject control characters under COLLATE "C".
--
-- private.edge_function_security_events.action was declared as
--   action text not null check (length(trim(action)) > 0)
-- with no upper length bound and no control-character gate. Hosted writers
-- in harden_workflow_authority already reject blank or length(action_name) > 160
-- and store trim(action_name). Bare POSIX [[:cntrl:]] follows database
-- LC_CTYPE; this cluster runs libc en_US.UTF-8. MISE-005A proved locale drift
-- on this cluster; sibling tips re-pin text CHECKs with
-- `collate "C" !~ '[[:cntrl:]]'`.
--
-- action is a durable single-line Edge Function invocation label
-- (e.g. supplier_email_blocked, function_error, sync action names). It is not
-- operator free-form multiline prose and must not accept LF/TAB/CR/NUL. If
-- LC_CTYPE drifted under a bare (or missing) cntrl gate, dump/restore could
-- accept action bytes a restored C-locale path would refuse — or the reverse
-- — breaking Edge Function reservation and rate-limit continuity across
-- restore.
--
-- Scope:
--   - Replace edge_function_security_events_action_check with
--     length(trim(action)) between 1 and 160 PLUS ASCII control rejection
--     under COLLATE "C" (preserves non-empty trim; adds the writer 160
--     ceiling to the column CHECK)
-- Does NOT rewrite reservation / completion writers, edge_function_policy,
-- function_name (#486 / MISE-005BZ), or event_type (#487 / MISE-005CA).
-- Timestamp after MISE-005HH (#624).

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'private.edge_function_security_events'::regclass
      and con.contype = 'c'
      and (
        con.conname = 'edge_function_security_events_action_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%action%'
          and (
            pg_get_constraintdef(con.oid) ilike '%length%trim%action%'
            or pg_get_constraintdef(con.oid) ilike '%[[:cntrl:]]%'
          )
          and pg_get_constraintdef(con.oid) not ilike '%function_name%'
          and pg_get_constraintdef(con.oid) not ilike '%event_type%'
          and pg_get_constraintdef(con.oid) not ilike '%metadata%'
          and pg_get_constraintdef(con.oid) not ilike '%restaurant_id%'
          and con.conname is distinct from 'edge_function_security_events_function_name_check'
          and con.conname is distinct from 'edge_function_security_events_event_type_check'
          and con.conname is distinct from 'edge_function_security_events_metadata_object_check'
        )
      )
    order by con.conname
  loop
    execute format(
      'alter table private.edge_function_security_events drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table private.edge_function_security_events
  drop constraint if exists edge_function_security_events_action_check;

alter table private.edge_function_security_events
  add constraint edge_function_security_events_action_check check (
    length(trim(action)) between 1 and 160
    and action collate "C" !~ '[[:cntrl:]]'
  );

comment on constraint edge_function_security_events_action_check
  on private.edge_function_security_events is
  'MISE-005HI: edge_function_security_events action length(trim) 1..160 plus ASCII control rejection under COLLATE "C".';
