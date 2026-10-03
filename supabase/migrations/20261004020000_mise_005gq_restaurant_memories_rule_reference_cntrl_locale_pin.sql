-- MISE-005GQ: pin public.restaurant_memories.rule_reference CHECK to reject
-- control characters under COLLATE "C".
--
-- restaurant_memories.rule_reference was declared as nullable text with no
-- CHECK on the operational-backend foundation table. There is still no
-- control-character gate and no length bound. Bare POSIX [[:cntrl:]] follows
-- database LC_CTYPE; this cluster runs libc en_US.UTF-8. MISE-005A proved
-- locale drift on this cluster; sibling tips re-pin text CHECKs with
-- `collate "C" !~ '[[:cntrl:]]'`.
--
-- rule_reference is reserved single-line system correlation text linking a
-- restaurant memory to an autonomy rule (or equivalent rule identity). It is
-- not operator free-form multiline prose and must not accept LF/TAB/CR/NUL.
-- Sibling restaurant_memories identity/ref text (dedupe_key) and action-ledger
-- ID/ref columns (idempotency_key, trigger_reference, rollback_reference)
-- already use a length(trim) 1..240 window, so this tip adopts the same bound
-- for parity across system reference text. If LC_CTYPE drifted under a bare
-- (or missing) cntrl gate, dump/restore could accept rule_reference bytes a
-- restored C-locale path would refuse — or the reverse — breaking
-- memory-to-rule correlation continuity across restore.
--
-- Scope:
--   - Attach restaurant_memories_rule_reference_check as null OR
--     length(trim(rule_reference)) 1..240 PLUS ASCII control rejection under
--     COLLATE "C"
-- Does NOT rewrite memory writers, source (#566), statement (#563),
-- correction (#565), dedupe_key (#570), memory vocabulary (#511), or
-- restaurant_autonomy_rules.
-- Timestamp after MISE-005GP (#606).

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
        con.conname = 'restaurant_memories_rule_reference_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%rule_reference%'
          and (
            pg_get_constraintdef(con.oid) ilike '%length%trim%rule_reference%'
            or pg_get_constraintdef(con.oid) ilike '%[[:cntrl:]]%'
          )
          and pg_get_constraintdef(con.oid) not ilike '%statement%'
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
  drop constraint if exists restaurant_memories_rule_reference_check;

alter table public.restaurant_memories
  add constraint restaurant_memories_rule_reference_check check (
    rule_reference is null
    or (
      length(trim(rule_reference)) between 1 and 240
      and rule_reference collate "C" !~ '[[:cntrl:]]'
    )
  );

comment on constraint restaurant_memories_rule_reference_check on public.restaurant_memories is
  'MISE-005GQ: restaurant memory rule_reference null or length(trim) 1..240 plus ASCII control rejection under COLLATE "C".';
