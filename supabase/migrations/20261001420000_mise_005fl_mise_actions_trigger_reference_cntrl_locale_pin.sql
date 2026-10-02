-- MISE-005FL: pin public.mise_actions.trigger_reference CHECK to reject
-- control characters under COLLATE "C".
--
-- mise_actions.trigger_reference was declared as nullable text with no
-- CHECK. Writers currently pass UUID text via new.id::text / orders.id::text
-- without truncation. The activity_events sibling writer already normalizes via
--   nullif(left(trim(p_trigger_reference), 240), '')
-- so this tip adopts the same null-or-length(trim) 1..240 window for parity
-- across the shared trigger_reference concept. There was still no
-- control-character gate. Bare POSIX [[:cntrl:]] follows database LC_CTYPE;
-- this cluster runs libc en_US.UTF-8. MISE-005A proved locale drift on this
-- cluster; sibling tips re-pin text CHECKs with
-- `collate "C" !~ '[[:cntrl:]]'`.
--
-- trigger_reference is durable single-line system correlation text on the
-- action ledger (supplier order UUIDs and similar ID refs). It is not operator
-- free-form and must not accept LF/TAB/CR/NUL. If LC_CTYPE drifted under a bare
-- (or missing) cntrl gate, dump/restore could accept trigger_reference bytes a
-- restored C-locale path would refuse — or the reverse — breaking action-ledger
-- continuity across restore.
--
-- Scope:
--   - Attach mise_actions_trigger_reference_check as null OR
--     length(trim(trigger_reference)) 1..240 PLUS ASCII control rejection
--     under COLLATE "C" (matches activity sibling 240 bound)
-- Does NOT rewrite mise_actions writers/triggers, activity_events.trigger_reference
-- (#571), mise_actions.trigger_type, error_code (#441/#449), error_message,
-- rollback_reference, idempotency_key (#457), reason, or activity title/summary/
-- source/trigger_type/idempotency/related_entity/sequence/error_code tips.
-- Timestamp after MISE-005FK (#575).

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.mise_actions'::regclass
      and con.contype = 'c'
      and (
        con.conname = 'mise_actions_trigger_reference_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%trigger_reference%'
          and (
            pg_get_constraintdef(con.oid) ilike '%length%trim%trigger_reference%'
            or pg_get_constraintdef(con.oid) ilike '%[[:cntrl:]]%'
          )
          and pg_get_constraintdef(con.oid) not ilike '%trigger_type%'
          and pg_get_constraintdef(con.oid) not ilike '%error_code%'
          and pg_get_constraintdef(con.oid) not ilike '%error_message%'
          and pg_get_constraintdef(con.oid) not ilike '%rollback_reference%'
          and pg_get_constraintdef(con.oid) not ilike '%idempotency_key%'
          and pg_get_constraintdef(con.oid) not ilike '%reason%'
          and pg_get_constraintdef(con.oid) not ilike '%action_type%'
          and pg_get_constraintdef(con.oid) not ilike '%execution_mode%'
          and pg_get_constraintdef(con.oid) not ilike '%status%'
        )
      )
    order by con.conname
  loop
    execute format(
      'alter table public.mise_actions drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table public.mise_actions
  drop constraint if exists mise_actions_trigger_reference_check;

alter table public.mise_actions
  add constraint mise_actions_trigger_reference_check check (
    trigger_reference is null
    or (
      length(trim(trigger_reference)) between 1 and 240
      and trigger_reference collate "C" !~ '[[:cntrl:]]'
    )
  );

comment on constraint mise_actions_trigger_reference_check on public.mise_actions is
  'MISE-005FL: mise action trigger_reference null or length(trim) 1..240 plus ASCII control rejection under COLLATE "C".';
