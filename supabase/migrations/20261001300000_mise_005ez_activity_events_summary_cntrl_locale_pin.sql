-- MISE-005EZ: pin public.activity_events.summary CHECK to reject unsafe
-- control characters under COLLATE "C", while allowing multiline summaries.
--
-- activity_events.summary only enforced
--   length(trim(summary)) between 1 and 1000
-- It had no control-character gate. Bare POSIX [[:cntrl:]] would also reject
-- LF (and the established supplier-send / operator-note multiline allowlist),
-- so this tip uses the same byte class as services/miseValidation.ts
-- `unsafeSupplierSendMultilineControlPattern`:
--   reject U+0000–U+0008, U+000B, U+000C, U+000E–U+001F, U+007F
--   allow LF (U+000A), and also TAB (U+0009) / CR (U+000D) for parity
--   with the established multiline control pattern.
--
-- Activity summary is durable operator-feed prose on the append-only activity
-- ledger. Most writers mint single-line format() text, but the supplier-
-- delivery memory path copies
--   left(coalesce(memory_row.correction, memory_row.statement), 1000)
-- into summary. Operator corrections are free-form and may contain LF; a full
-- [[:cntrl:]] gate would fail-closed those delivery memory updates. If
-- LC_CTYPE drifted under a bare (or missing) cntrl gate, dump/restore could
-- accept summary bytes a restored C-locale path would refuse — or the reverse
-- — breaking activity-evidence continuity across restore.
--
-- Scope:
--   - Reattach activity_events_summary_check preserving the exact
--     length(trim(summary)) between 1 and 1000 bound PLUS multiline-aware
--     ASCII control rejection under COLLATE "C"
-- Does NOT rewrite append_activity_event / record_activity_event RPCs,
-- activity_events.title (#560), restaurant_memories.correction/statement
-- (#563), or supplier_orders.operator_note (#551).
-- Timestamp after MISE-005EY (#563).

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
        con.conname = 'activity_events_summary_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%summary%'
          and pg_get_constraintdef(con.oid) ilike '%length%trim%summary%'
          and pg_get_constraintdef(con.oid) not ilike '%title%'
          and pg_get_constraintdef(con.oid) not ilike '%trigger_type%'
          and pg_get_constraintdef(con.oid) not ilike '%idempotency_key%'
          and pg_get_constraintdef(con.oid) not ilike '%error_message%'
          and pg_get_constraintdef(con.oid) not ilike '%source%'
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
  drop constraint if exists activity_events_summary_check;

alter table public.activity_events
  add constraint activity_events_summary_check check (
    length(trim(summary)) between 1 and 1000
    and summary collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'
  );

comment on constraint activity_events_summary_check on public.activity_events is
  'MISE-005EZ: activity event summary length(trim) 1..1000 plus multiline-aware ASCII control rejection under COLLATE "C" (allows LF/TAB/CR; rejects other C0 controls and DEL).';
