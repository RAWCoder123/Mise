-- MISE-005FQ: pin public.activity_events.error_message CHECK to reject unsafe
-- control characters under COLLATE "C", while allowing multiline messages.
--
-- activity_events.error_message was declared as nullable text with no length or
-- control-character gate. Current writers persist operator-facing failure prose
-- via nullif(left(trim(p_error_message), 1000), '') in
-- private.service_append_activity_event / record_activity paths, and the
-- supplier-send failure recorder also passes left(trim(p_error_message), 1000)
-- into activity. Bare POSIX [[:cntrl:]] would also reject LF (and the
-- established supplier-send / operator-note multiline allowlist), so this tip
-- uses the same byte class as services/miseValidation.ts
-- `unsafeSupplierSendMultilineControlPattern`:
--   reject U+0000–U+0008, U+000B, U+000C, U+000E–U+001F, U+007F
--   allow LF (U+000A), and also TAB (U+0009) / CR (U+000D) for parity
--   with the established multiline control pattern.
--
-- error_message is durable operator-facing failure prose on the append-only
-- activity ledger. It is free-form-ish diagnostic sentence text (not a
-- single-line system key like error_code). If LC_CTYPE drifted under a bare
-- (or missing) cntrl gate, dump/restore could accept error_message bytes a
-- restored C-locale path would refuse — or the reverse — breaking
-- activity-feed continuity across restore.
--
-- Scope:
--   - Add activity_events_error_message_check as null OR
--     length(trim(error_message)) between 1 and 1000 PLUS multiline-aware
--     ASCII control rejection under COLLATE "C"
-- Does NOT rewrite activity RPCs, title (#560), summary (#564), source (#567),
-- trigger_type (#568), idempotency_key (#569), trigger_reference (#571),
-- related_entity_type (#572), related_entity_id (#573), sequence_id (#574),
-- error_code (#575), or mise_actions.error_message (#580).
-- Timestamp after MISE-005FP (#580).

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.activity_events'::regclass
      and con.contype = 'c'
      and (
        con.conname = 'activity_events_error_message_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%error_message%'
          and pg_get_constraintdef(con.oid) ilike '%length%trim%error_message%'
          and pg_get_constraintdef(con.oid) not ilike '%error_code%'
          and pg_get_constraintdef(con.oid) not ilike '%sequence_id%'
          and pg_get_constraintdef(con.oid) not ilike '%related_entity_id%'
          and pg_get_constraintdef(con.oid) not ilike '%related_entity_type%'
          and pg_get_constraintdef(con.oid) not ilike '%trigger_reference%'
          and pg_get_constraintdef(con.oid) not ilike '%trigger_type%'
          and pg_get_constraintdef(con.oid) not ilike '%title%'
          and pg_get_constraintdef(con.oid) not ilike '%summary%'
          and pg_get_constraintdef(con.oid) not ilike '%source%'
          and pg_get_constraintdef(con.oid) not ilike '%idempotency_key%'
          and pg_get_constraintdef(con.oid) not ilike '%correlation_id%'
          and pg_get_constraintdef(con.oid) not ilike '%causation_id%'
          and pg_get_constraintdef(con.oid) not ilike '%source_systems%'
          and pg_get_constraintdef(con.oid) not ilike '%event_type%'
          and pg_get_constraintdef(con.oid) not ilike '%category%'
          and pg_get_constraintdef(con.oid) not ilike '%actor_type%'
          and pg_get_constraintdef(con.oid) not ilike '%status%'
        )
      )
    order by con.conname
  loop
    execute format(
      'alter table public.activity_events drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table public.activity_events
  drop constraint if exists activity_events_error_message_check;

alter table public.activity_events
  add constraint activity_events_error_message_check check (
    error_message is null
    or (
      length(trim(error_message)) between 1 and 1000
      and error_message collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'
    )
  );

comment on constraint activity_events_error_message_check on public.activity_events is
  'MISE-005FQ: activity event error_message null or length(trim) 1..1000 plus multiline-aware ASCII control rejection under COLLATE "C" (allows LF/TAB/CR; rejects other C0 controls and DEL).';
