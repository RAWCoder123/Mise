-- MISE-005HG: pin public.inventory_events.source_reference CHECK to reject
-- control characters under COLLATE "C".
--
-- inventory_events.source_reference was declared as nullable text with no
-- control-character gate. Open #370 may already attach
-- inventory_events_source_reference_length_check as
--   source_reference is null or char_length(source_reference) <= 200
-- with a BEFORE INSERT oversize trigger, but that length-only CHECK still has
-- no COLLATE "C" ASCII control rejection. Bare POSIX [[:cntrl:]] follows
-- database LC_CTYPE; this cluster runs libc en_US.UTF-8. MISE-005A proved
-- locale drift on this cluster; sibling tips re-pin text CHECKs with
-- `collate "C" !~ '[[:cntrl:]]'`.
--
-- source_reference is a durable nullable single-line correlation key on the
-- append-only inventory ledger (delivery IDs, count session IDs, outbox
-- references). Writer paths store nullif(trim(p_source_reference), ''). It is
-- not operator free-form multiline prose and must not accept LF/TAB/CR/NUL.
-- If LC_CTYPE drifted under a bare (or missing) cntrl gate, dump/restore could
-- accept source_reference bytes a restored C-locale path would refuse — or the
-- reverse — breaking inventory-ledger correlation continuity across restore.
--
-- Scope:
--   - Attach inventory_events_source_reference_check as null OR
--     length(trim(source_reference)) 1..200 PLUS ASCII control rejection
--     under COLLATE "C" (mirrors the 200 ceiling already used by
--     requireInventoryOperation / #370)
--   - Drop any prior source_reference length-only CHECK (#370) so one
--     dedicated constraint owns the column; leave the #370 BEFORE INSERT
--     oversize trigger untouched when present
--   - Dedicated CHECK so this tip stays alone-OK versus source (#622),
--     client_event_id / idempotency_key (#478), event_type (#492), and
--     quantity/supersedes/canonical_unit/metadata CHECKs
-- Does NOT rewrite record_inventory_event, the #370 oversize trigger,
-- identity shape gates (#478), event_type (#492), or source (#622).
-- Timestamp after MISE-005HF (#622).

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.inventory_events'::regclass
      and con.contype = 'c'
      and (
        con.conname in (
          'inventory_events_source_reference_check',
          'inventory_events_source_reference_length_check'
        )
        or (
          pg_get_constraintdef(con.oid) ilike '%source_reference%'
          and (
            pg_get_constraintdef(con.oid) ilike '%length%trim%source_reference%'
            or pg_get_constraintdef(con.oid) ilike '%char_length%source_reference%'
            or pg_get_constraintdef(con.oid) ilike '%[[:cntrl:]]%'
          )
          and pg_get_constraintdef(con.oid) not ilike '%client_event_id%'
          and pg_get_constraintdef(con.oid) not ilike '%idempotency_key%'
          and pg_get_constraintdef(con.oid) not ilike '%event_type%'
          and pg_get_constraintdef(con.oid) not ilike '%canonical_unit%'
          and pg_get_constraintdef(con.oid) not ilike '%quantity%'
          and pg_get_constraintdef(con.oid) not ilike '%supersedes%'
          and pg_get_constraintdef(con.oid) not ilike '%metadata%'
          and pg_get_constraintdef(con.oid) not ilike '%authority_projected%'
          and pg_get_constraintdef(con.oid) not ilike '%reason_code%'
          -- Bare source CHECK (MISE-005HF) mentions "source" but not
          -- source_reference; the ilike '%source_reference%' gate above already
          -- excludes it. Keep an explicit name guard for clarity.
          and con.conname is distinct from 'inventory_events_source_check'
        )
      )
    order by con.conname
  loop
    execute format(
      'alter table public.inventory_events drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table public.inventory_events
  drop constraint if exists inventory_events_source_reference_check;

alter table public.inventory_events
  drop constraint if exists inventory_events_source_reference_length_check;

alter table public.inventory_events
  add constraint inventory_events_source_reference_check check (
    source_reference is null
    or (
      length(trim(source_reference)) between 1 and 200
      and source_reference collate "C" !~ '[[:cntrl:]]'
    )
  );

comment on constraint inventory_events_source_reference_check
  on public.inventory_events is
  'MISE-005HG: inventory_events source_reference null or length(trim) 1..200 plus ASCII control rejection under COLLATE "C".';
