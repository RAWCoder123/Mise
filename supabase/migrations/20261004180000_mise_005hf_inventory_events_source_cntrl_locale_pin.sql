-- MISE-005HF: pin public.inventory_events.source CHECK to reject
-- control characters under COLLATE "C".
--
-- inventory_events.source was declared as
--   source text not null check (length(trim(source)) between 1 and 80)
-- with no control-character gate. Bare POSIX [[:cntrl:]] follows database
-- LC_CTYPE; this cluster runs libc en_US.UTF-8. MISE-005A proved locale drift
-- on this cluster; sibling tips re-pin text CHECKs with
-- `collate "C" !~ '[[:cntrl:]]'`.
--
-- source is a durable single-line system/integration label on the append-only
-- inventory ledger (e.g. 'manual', 'pos', 'count_session', 'demo'). It is not
-- operator free-form multiline prose and must not accept LF/TAB/CR/NUL. If
-- LC_CTYPE drifted under a bare (or missing) cntrl gate, dump/restore could
-- accept source bytes a restored C-locale path would refuse — or the reverse —
-- breaking inventory-ledger source continuity across restore.
--
-- Scope:
--   - Reattach inventory_events_source_check preserving the exact
--     length(trim(source)) 1..80 bound PLUS ASCII control rejection under
--     COLLATE "C"
--   - Dedicated CHECK so this tip stays alone-OK versus client_event_id /
--     idempotency_key (#478), event_type (#492), source_reference (#370),
--     quantity/supersedes/canonical_unit/metadata/authority CHECKs
-- Does NOT rewrite record_inventory_event, source_reference bounds (#370),
-- identity shape gates (#478), event_type (#492), or activity_events.source
-- (#567).
-- Timestamp after MISE-005HE (#621).

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
        con.conname = 'inventory_events_source_check'
        or (
          pg_get_constraintdef(con.oid) ~* '\ysource\y'
          and (
            pg_get_constraintdef(con.oid) ilike '%length%trim%source%'
            or pg_get_constraintdef(con.oid) ilike '%[[:cntrl:]]%'
          )
          and pg_get_constraintdef(con.oid) not ilike '%source_reference%'
          and pg_get_constraintdef(con.oid) not ilike '%client_event_id%'
          and pg_get_constraintdef(con.oid) not ilike '%idempotency_key%'
          and pg_get_constraintdef(con.oid) not ilike '%event_type%'
          and pg_get_constraintdef(con.oid) not ilike '%canonical_unit%'
          and pg_get_constraintdef(con.oid) not ilike '%quantity%'
          and pg_get_constraintdef(con.oid) not ilike '%supersedes%'
          and pg_get_constraintdef(con.oid) not ilike '%metadata%'
          and pg_get_constraintdef(con.oid) not ilike '%authority_projected%'
          and pg_get_constraintdef(con.oid) not ilike '%reason_code%'
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
  drop constraint if exists inventory_events_source_check;

alter table public.inventory_events
  add constraint inventory_events_source_check check (
    length(trim(source)) between 1 and 80
    and source collate "C" !~ '[[:cntrl:]]'
  );

comment on constraint inventory_events_source_check
  on public.inventory_events is
  'MISE-005HF: inventory_events source length(trim) 1..80 plus ASCII control rejection under COLLATE "C".';
