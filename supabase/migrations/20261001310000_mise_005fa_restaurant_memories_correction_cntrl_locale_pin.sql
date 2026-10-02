-- MISE-005FA: pin public.restaurant_memories.correction CHECK to reject unsafe
-- control characters under COLLATE "C", while allowing multiline corrections.
--
-- restaurant_memories.correction was declared as unbounded nullable text with
-- no length or control-character gate. The only bound lived in
-- update_restaurant_memory as left(trim(p_correction), 1000). Bare POSIX
-- [[:cntrl:]] would also reject LF (and the established supplier-send /
-- operator-note multiline allowlist), so this tip uses the same byte class as
-- services/miseValidation.ts `unsafeSupplierSendMultilineControlPattern`:
--   reject U+0000–U+0008, U+000B, U+000C, U+000E–U+001F, U+007F
--   allow LF (U+000A), and also TAB (U+0009) / CR (U+000D) for parity
--   with the established multiline control pattern.
--
-- Correction is durable operator free-form text on the restaurant memories
-- ledger. When present it may contain intentional newlines. The supplier-
-- delivery memory path also copies
--   left(coalesce(memory_row.correction, memory_row.statement), 1000)
-- into activity_events.summary (#564), so a full [[:cntrl:]] gate here would
-- reject legitimate operator corrections and break that summary path. If
-- LC_CTYPE drifted under a bare (or missing) cntrl gate, dump/restore could
-- accept correction bytes a restored C-locale path would refuse — or the
-- reverse — breaking memory-evidence continuity across restore.
--
-- Scope:
--   - Add restaurant_memories_correction_check preserving nullability PLUS
--     length(trim(correction)) between 1 and 1000 when present PLUS
--     multiline-aware ASCII control rejection under COLLATE "C"
-- Does NOT rewrite update_restaurant_memory, statement (#563), source /
-- dedupe_key bounds, memory vocabulary (#511), or activity_events.summary
-- (#564).
-- Timestamp after MISE-005EZ (#564).

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.restaurant_memories'::regclass
      and con.contype = 'c'
      and (
        con.conname = 'restaurant_memories_correction_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%correction%'
          and pg_get_constraintdef(con.oid) not ilike '%statement%'
          and pg_get_constraintdef(con.oid) not ilike '%source%'
          and pg_get_constraintdef(con.oid) not ilike '%dedupe_key%'
          and pg_get_constraintdef(con.oid) not ilike '%memory_type%'
          and pg_get_constraintdef(con.oid) not ilike '%scope%'
          and pg_get_constraintdef(con.oid) not ilike '%status%'
          and pg_get_constraintdef(con.oid) not ilike '%corrected_by%'
          and pg_get_constraintdef(con.oid) not ilike '%corrected_at%'
        )
      )
    order by con.conname
  loop
    execute format(
      'alter table public.restaurant_memories drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table public.restaurant_memories
  drop constraint if exists restaurant_memories_correction_check;

alter table public.restaurant_memories
  add constraint restaurant_memories_correction_check check (
    correction is null
    or (
      length(trim(correction)) between 1 and 1000
      and correction collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'
    )
  );

comment on constraint restaurant_memories_correction_check on public.restaurant_memories is
  'MISE-005FA: restaurant memory correction null or length(trim) 1..1000 plus multiline-aware ASCII control rejection under COLLATE "C" (allows LF/TAB/CR; rejects other C0 controls and DEL).';
