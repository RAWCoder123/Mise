-- MISE-005FB: pin public.restaurant_memories.source CHECK to reject control
-- characters under COLLATE "C".
--
-- restaurant_memories.source was declared as
--   source text not null check (length(trim(source)) between 1 and 120)
-- with no control-character gate. Bare POSIX [[:cntrl:]] follows database
-- LC_CTYPE; this cluster runs libc en_US.UTF-8. MISE-005A proved locale drift
-- on this cluster; sibling tips re-pin text CHECKs with
-- `collate "C" !~ '[[:cntrl:]]'`.
--
-- source is durable single-line system label text on the restaurant memories
-- ledger (e.g. 'supplier_delivery_outcomes'). It is not operator free-form and
-- must not accept LF/TAB/CR. If LC_CTYPE drifted under a bare (or missing)
-- cntrl gate, dump/restore could accept source bytes a restored C-locale path
-- would refuse — or the reverse — breaking memory-evidence continuity across
-- restore.
--
-- Scope:
--   - Reattach restaurant_memories_source_check preserving the exact
--     length(trim(source)) 1..120 bound PLUS ASCII control rejection under
--     COLLATE "C"
-- Does NOT rewrite supplier-delivery / update_restaurant_memory writers,
-- statement (#563), correction (#565), dedupe_key, memory vocabulary (#511),
-- or activity_events.source.
-- Timestamp after MISE-005FA (#565).

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
        con.conname = 'restaurant_memories_source_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%source%'
          and pg_get_constraintdef(con.oid) ilike '%length%trim%source%'
          and pg_get_constraintdef(con.oid) not ilike '%statement%'
          and pg_get_constraintdef(con.oid) not ilike '%correction%'
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
  drop constraint if exists restaurant_memories_source_check;

alter table public.restaurant_memories
  add constraint restaurant_memories_source_check check (
    length(trim(source)) between 1 and 120
    and source collate "C" !~ '[[:cntrl:]]'
  );

comment on constraint restaurant_memories_source_check on public.restaurant_memories is
  'MISE-005FB: restaurant memory source length(trim) 1..120 plus ASCII control rejection under COLLATE "C".';
