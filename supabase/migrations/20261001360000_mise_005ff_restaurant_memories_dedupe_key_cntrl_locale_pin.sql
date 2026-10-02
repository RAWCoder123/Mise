-- MISE-005FF: pin public.restaurant_memories.dedupe_key CHECK to reject
-- control characters under COLLATE "C".
--
-- restaurant_memories.dedupe_key was declared as
--   dedupe_key text not null check (length(trim(dedupe_key)) between 1 and 240)
-- with no control-character gate. Bare POSIX [[:cntrl:]] follows database
-- LC_CTYPE; this cluster runs libc en_US.UTF-8. MISE-005A proved locale drift
-- on this cluster; sibling tips re-pin text CHECKs with
-- `collate "C" !~ '[[:cntrl:]]'`.
--
-- dedupe_key is the durable per-restaurant unique memory identity
-- (UNIQUE (restaurant_id, dedupe_key)). Hosted writers mint single-line system
-- keys that intentionally include supplier presentation text and UUIDs:
--   supplier-delivery-outcome:<lower(trim(supplier_name))>   -- legacy name key
--   supplier-delivery-outcome:<supplier_id>                  -- durable ID key
--   legacy-supplier-delivery-outcome:<memory_id>             -- parked legacy
-- Supplier display names routinely include spaces and punctuation, so a narrow
-- ASCII charset tip would reject valid legacy keys. Control rejection preserves
-- those writers while closing the locale-drift hole. It is not operator
-- free-form multiline text and must not accept LF/TAB/CR/NUL.
-- If LC_CTYPE drifted under a bare (or missing) cntrl gate, dump/restore could
-- accept dedupe_key bytes a restored C-locale path would refuse — or the
-- reverse — breaking memory-identity continuity across restore.
--
-- Scope:
--   - Reattach restaurant_memories_dedupe_key_check preserving the exact
--     length(trim(dedupe_key)) 1..240 bound PLUS ASCII control rejection
--     under COLLATE "C"
-- Does NOT rewrite supplier-delivery / update_restaurant_memory writers,
-- source (#566), statement (#563), correction (#565), memory vocabulary (#511),
-- or operational_issues.dedupe_key (#456).
-- Timestamp after MISE-005FE (#569).

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
        con.conname = 'restaurant_memories_dedupe_key_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%dedupe_key%'
          and (
            pg_get_constraintdef(con.oid) ilike '%length%trim%dedupe_key%'
            or pg_get_constraintdef(con.oid) ilike '%length(dedupe_key)%'
            or pg_get_constraintdef(con.oid) ilike '%[[:cntrl:]]%'
            or pg_get_constraintdef(con.oid) ilike '%^[A-Za-z0-9%'
          )
          and pg_get_constraintdef(con.oid) not ilike '%statement%'
          and pg_get_constraintdef(con.oid) not ilike '%correction%'
          and pg_get_constraintdef(con.oid) not ilike '%source%'
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
  drop constraint if exists restaurant_memories_dedupe_key_check;

alter table public.restaurant_memories
  add constraint restaurant_memories_dedupe_key_check check (
    length(trim(dedupe_key)) between 1 and 240
    and dedupe_key collate "C" !~ '[[:cntrl:]]'
  );

comment on constraint restaurant_memories_dedupe_key_check on public.restaurant_memories is
  'MISE-005FF: restaurant memory dedupe_key length(trim) 1..240 plus ASCII control rejection under COLLATE "C".';
