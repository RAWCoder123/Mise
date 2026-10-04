-- MISE-005HH: pin public.inventory_events.reason_code CHECK to reject
-- control characters under COLLATE "C".
--
-- inventory_events.reason_code was declared as nullable text with no
-- control-character gate. Open #368 may already attach
-- inventory_events_reason_code_length_check as
--   reason_code is null or char_length(reason_code) <= 80
-- and rewrite record_inventory_event to reject oversize reasons, but that
-- length-only CHECK still has no COLLATE "C" ASCII control rejection. Bare
-- POSIX [[:cntrl:]] follows database LC_CTYPE; this cluster runs libc
-- en_US.UTF-8. MISE-005A proved locale drift on this cluster; sibling tips
-- re-pin text CHECKs with `collate "C" !~ '[[:cntrl:]]'`.
--
-- reason_code is a durable nullable single-line ledger evidence label
-- (e.g. cycle_count, demo_closeout, spoilage categories). Writer paths store
-- nullif(trim(p_reason_code), ''). It is not operator free-form multiline
-- prose and must not accept LF/TAB/CR/NUL. If LC_CTYPE drifted under a bare
-- (or missing) cntrl gate, dump/restore could accept reason_code bytes a
-- restored C-locale path would refuse — or the reverse — breaking inventory
-- ledger evidence continuity across restore.
--
-- Scope:
--   - Attach inventory_events_reason_code_check as null OR
--     length(trim(reason_code)) 1..80 PLUS ASCII control rejection under
--     COLLATE "C" (mirrors the 80 ceiling already used by optionalBoundedText
--     / securityLimits / open #368)
--   - Drop any prior reason_code length-only CHECK (#368) so one dedicated
--     constraint owns the column; leave the #368 record_inventory_event
--     oversize rewrite untouched when present
--   - Dedicated CHECK so this tip stays alone-OK versus source (#622),
--     source_reference (#623), client_event_id / idempotency_key (#478),
--     event_type (#492), and quantity/supersedes/canonical_unit/metadata
--     CHECKs
-- Does NOT rewrite record_inventory_event, identity shape gates (#478),
-- event_type (#492), source (#622), or source_reference (#623).
-- Does NOT touch private.operational_mode_changes.reason_code or
-- private.pilot_operational_control_changes.reason_code (#448).
-- Timestamp after MISE-005HG (#623).

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
          'inventory_events_reason_code_check',
          'inventory_events_reason_code_length_check'
        )
        or (
          pg_get_constraintdef(con.oid) ilike '%reason_code%'
          and (
            pg_get_constraintdef(con.oid) ilike '%length%trim%reason_code%'
            or pg_get_constraintdef(con.oid) ilike '%char_length%reason_code%'
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
          and pg_get_constraintdef(con.oid) not ilike '%source_reference%'
          -- Bare source CHECK (MISE-005HF) mentions "source" but not
          -- reason_code; the ilike '%reason_code%' gate above already
          -- excludes it. Keep an explicit name guard for clarity.
          and con.conname is distinct from 'inventory_events_source_check'
          and con.conname is distinct from 'inventory_events_source_reference_check'
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
  drop constraint if exists inventory_events_reason_code_check;

alter table public.inventory_events
  drop constraint if exists inventory_events_reason_code_length_check;

alter table public.inventory_events
  add constraint inventory_events_reason_code_check check (
    reason_code is null
    or (
      length(trim(reason_code)) between 1 and 80
      and reason_code collate "C" !~ '[[:cntrl:]]'
    )
  );

comment on constraint inventory_events_reason_code_check
  on public.inventory_events is
  'MISE-005HH: inventory_events reason_code null or length(trim) 1..80 plus ASCII control rejection under COLLATE "C".';
