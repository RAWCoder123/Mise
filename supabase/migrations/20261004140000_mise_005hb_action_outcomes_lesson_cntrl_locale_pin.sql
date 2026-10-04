-- MISE-005HB: pin public.action_outcomes.lesson CHECK to reject unsafe
-- control characters under COLLATE "C", while allowing multiline lessons.
--
-- action_outcomes.lesson was declared as unbounded nullable text with no
-- length or control-character gate. The only bound lived in the
-- capture_action_outcome_activity trigger as
--   nullif(left(trim(new.lesson), 1000), '')
-- when copying the lesson into activity_events.summary (#564). Bare POSIX
-- [[:cntrl:]] would also reject LF (and the established supplier-send /
-- operator-note multiline allowlist), so this tip uses the same byte class as
-- services/miseValidation.ts `unsafeSupplierSendMultilineControlPattern`:
--   reject U+0000–U+0008, U+000B, U+000C, U+000E–U+001F, U+007F
--   allow LF (U+000A), and also TAB (U+0009) / CR (U+000D) for parity
--   with the established multiline control pattern.
--
-- Lesson is durable free-form outcome text on the append-only action
-- outcomes ledger. When present it may contain intentional newlines and
-- flows into activity_events.summary, so a full [[:cntrl:]] gate here would
-- reject legitimate lessons and break that summary path. If LC_CTYPE drifted
-- under a bare (or missing) cntrl gate, dump/restore could accept lesson
-- bytes a restored C-locale path would refuse — or the reverse — breaking
-- outcome-evidence continuity across restore.
--
-- Scope:
--   - Add action_outcomes_lesson_check preserving nullability PLUS
--     length(trim(lesson)) between 1 and 1000 when present PLUS
--     multiline-aware ASCII control rejection under COLLATE "C"
-- Does NOT rewrite capture_action_outcome_activity, measure_outcome writers,
-- idempotency_key (#457), jsonb payload bounds, or activity_events.summary
-- (#564).
-- Timestamp after MISE-005HA (#617).

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.action_outcomes'::regclass
      and con.contype = 'c'
      and (
        con.conname = 'action_outcomes_lesson_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%lesson%'
          and pg_get_constraintdef(con.oid) not ilike '%idempotency_key%'
          and pg_get_constraintdef(con.oid) not ilike '%expected_result%'
          and pg_get_constraintdef(con.oid) not ilike '%actual_result%'
          and pg_get_constraintdef(con.oid) not ilike '%variance%'
          and pg_get_constraintdef(con.oid) not ilike '%payload%'
          and pg_get_constraintdef(con.oid) not ilike '%action_id%'
          and pg_get_constraintdef(con.oid) not ilike '%measured_at%'
        )
      )
    order by con.conname
  loop
    execute format(
      'alter table public.action_outcomes drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table public.action_outcomes
  drop constraint if exists action_outcomes_lesson_check;

alter table public.action_outcomes
  add constraint action_outcomes_lesson_check check (
    lesson is null
    or (
      length(trim(lesson)) between 1 and 1000
      and lesson collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'
    )
  );

comment on constraint action_outcomes_lesson_check on public.action_outcomes is
  'MISE-005HB: action outcome lesson null or length(trim) 1..1000 plus multiline-aware ASCII control rejection under COLLATE "C" (allows LF/TAB/CR; rejects other C0 controls and DEL).';
