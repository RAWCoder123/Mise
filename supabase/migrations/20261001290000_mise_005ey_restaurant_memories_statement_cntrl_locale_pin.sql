-- MISE-005EY: pin public.restaurant_memories.statement CHECK to reject
-- control characters under COLLATE "C".
--
-- restaurant_memories.statement only enforced
--   length(trim(statement)) between 1 and 1000
-- It had no control-character gate. Bare POSIX [[:cntrl:]] follows database
-- LC_CTYPE; this cluster runs libc en_US.UTF-8. MISE-005A proved locale drift
-- on this cluster; sibling tips re-pin text CHECKs with
-- `collate "C" !~ '[[:cntrl:]]'`.
--
-- Memory statement is durable single-line learned-pattern prose on the
-- restaurant memories ledger (minted by format() in supplier-delivery and
-- related memory writers). Writers do not intentionally preserve LF/TAB.
-- Operator free-form corrections live on the separate `correction` column and
-- are out of scope. If LC_CTYPE drifted under a bare (or missing) cntrl gate,
-- dump/restore could accept statement bytes a restored C-locale path would
-- refuse — or the reverse — breaking memory-evidence continuity across restore.
--
-- Scope:
--   - Reattach restaurant_memories_statement_check preserving the exact
--     length(trim(statement)) between 1 and 1000 bound PLUS ASCII control
--     rejection under COLLATE "C"
-- Does NOT rewrite update_restaurant_memory, correction/source/dedupe_key
-- bounds, memory vocabulary (#511), activity_events.summary/title (#560),
-- or operational_issues.explanation (#562).
-- Timestamp after MISE-005EX (#562).

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
        con.conname = 'restaurant_memories_statement_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%statement%'
          and pg_get_constraintdef(con.oid) ilike '%length%trim%statement%'
          and pg_get_constraintdef(con.oid) not ilike '%correction%'
          and pg_get_constraintdef(con.oid) not ilike '%source%'
          and pg_get_constraintdef(con.oid) not ilike '%dedupe_key%'
          and pg_get_constraintdef(con.oid) not ilike '%memory_type%'
          and pg_get_constraintdef(con.oid) not ilike '%scope%'
          and pg_get_constraintdef(con.oid) not ilike '%status%'
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
  drop constraint if exists restaurant_memories_statement_check;

alter table public.restaurant_memories
  add constraint restaurant_memories_statement_check check (
    length(trim(statement)) between 1 and 1000
    and statement collate "C" !~ '[[:cntrl:]]'
  );

comment on constraint restaurant_memories_statement_check on public.restaurant_memories is
  'MISE-005EY: restaurant memory statement length(trim) 1..1000 plus ASCII control rejection under COLLATE "C".';
