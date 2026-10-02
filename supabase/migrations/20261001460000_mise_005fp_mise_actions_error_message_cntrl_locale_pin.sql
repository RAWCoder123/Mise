-- MISE-005FP: pin public.mise_actions.error_message CHECK to reject unsafe
-- control characters under COLLATE "C", while allowing multiline messages.
--
-- mise_actions.error_message was declared as nullable text with no length or
-- control-character gate. Current writers persist operator-facing failure prose
-- via left(trim(p_error_message), 1000) in
-- private.service_record_mise_action_failure, and mint fixed sentences such as
--   'The Gmail delivery result is uncertain and requires review.'
--   'The supplier order was not sent because the delivery workflow failed.'
-- Edge callers also slice to 1000 before RPC. Bare POSIX [[:cntrl:]] would also
-- reject LF (and the established supplier-send / operator-note multiline
-- allowlist), so this tip uses the same byte class as services/miseValidation.ts
-- `unsafeSupplierSendMultilineControlPattern`:
--   reject U+0000–U+0008, U+000B, U+000C, U+000E–U+001F, U+007F
--   allow LF (U+000A), and also TAB (U+0009) / CR (U+000D) for parity
--   with the established multiline control pattern.
--
-- error_message is durable operator-facing failure prose on the mise_actions
-- ledger. It is free-form-ish diagnostic sentence text (not a single-line
-- system key like error_code). If LC_CTYPE drifted under a bare (or missing)
-- cntrl gate, dump/restore could accept error_message bytes a restored
-- C-locale path would refuse — or the reverse — breaking action-ledger
-- continuity across restore.
--
-- Scope:
--   - Add mise_actions_error_message_check as null OR
--     length(trim(error_message)) between 1 and 1000 PLUS multiline-aware
--     ASCII control rejection under COLLATE "C"
-- Does NOT rewrite mise_actions writers/triggers, reason (#579),
-- rollback_reference (#578), trigger_type (#577), trigger_reference (#576),
-- error_code (#441/#449), or idempotency_key (#457).
-- Timestamp after MISE-005FO (#579).

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
        con.conname = 'mise_actions_error_message_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%error_message%'
          and pg_get_constraintdef(con.oid) ilike '%length%trim%error_message%'
          and pg_get_constraintdef(con.oid) not ilike '%trigger_type%'
          and pg_get_constraintdef(con.oid) not ilike '%trigger_reference%'
          and pg_get_constraintdef(con.oid) not ilike '%error_code%'
          and pg_get_constraintdef(con.oid) not ilike '%reason%'
          and pg_get_constraintdef(con.oid) not ilike '%idempotency_key%'
          and pg_get_constraintdef(con.oid) not ilike '%rollback_reference%'
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
  drop constraint if exists mise_actions_error_message_check;

alter table public.mise_actions
  add constraint mise_actions_error_message_check check (
    error_message is null
    or (
      length(trim(error_message)) between 1 and 1000
      and error_message collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'
    )
  );

comment on constraint mise_actions_error_message_check on public.mise_actions is
  'MISE-005FP: mise action error_message null or length(trim) 1..1000 plus multiline-aware ASCII control rejection under COLLATE "C" (allows LF/TAB/CR; rejects other C0 controls and DEL).';
