-- MISE-005GK: pin public.pos_locations.display_name CHECK to reject
-- control characters under COLLATE "C" and lock the POS location length
-- bound.
--
-- pos_locations.display_name is durable NOT NULL text
-- (operational_data_foundation_inventory_ledger) with no table-level length
-- or control-character gate. Square OAuth/location sync writers
-- (square_backend_oauth_sync and _shared/square.ts stringField(..., 200))
-- persist left(display_name, 200) / name truncated to 200 and skip empty
-- display names. Bare POSIX [[:cntrl:]] follows database LC_CTYPE; this
-- cluster runs libc en_US.UTF-8. MISE-005A proved locale drift on this
-- cluster; sibling tips re-pin text CHECKs with
-- `collate "C" !~ '[[:cntrl:]]'`.
--
-- display_name is a durable single-line POS location label (provider
-- location display name mirrored into the location row). It is not
-- free-form multiline prose and must not accept LF/TAB/CR/NUL. If
-- LC_CTYPE drifted under a bare (or missing) cntrl gate, dump/restore
-- could accept display_name bytes a restored C-locale path would refuse
-- — or the reverse — breaking POS location continuity and operator
-- readability across restore.
--
-- Scope:
--   - Attach pos_locations_display_name_check as
--     length(trim(display_name)) between 1 and 200 PLUS ASCII control
--     rejection under COLLATE "C" (matches Square left(..., 200) writers)
--   - Dedicated CHECK so this tip stays alone-OK versus
--     pos_locations_status_check and versus pos_integrations.external_location_id
--     (#466) / pos_catalog_item_mappings.external_name (#598) /
--     inventory/pos_sales/purchase/count-line stacks
-- Does NOT rewrite Square OAuth / location sync writers, status CHECK,
-- external_location_id, or sibling identity stacks.
-- Timestamp after MISE-005GJ (#600).

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.pos_locations'::regclass
      and con.contype = 'c'
      and (
        con.conname = 'pos_locations_display_name_check'
        or (
          pg_get_constraintdef(con.oid) ~* '\ydisplay_name\y'
          and (
            pg_get_constraintdef(con.oid) ilike '%length%trim%display_name%'
            or pg_get_constraintdef(con.oid) ilike '%length(display_name)%'
            or pg_get_constraintdef(con.oid) ilike '%[[:cntrl:]]%'
          )
          and pg_get_constraintdef(con.oid) not ilike '%external_location_id%'
          and pg_get_constraintdef(con.oid) not ilike '%status%'
          and pg_get_constraintdef(con.oid) not ilike '%timezone%'
        )
      )
    order by con.conname
  loop
    execute format(
      'alter table public.pos_locations drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table public.pos_locations
  drop constraint if exists pos_locations_display_name_check;

alter table public.pos_locations
  add constraint pos_locations_display_name_check check (
    length(trim(display_name)) between 1 and 200
    and display_name collate "C" !~ '[[:cntrl:]]'
  );

comment on constraint pos_locations_display_name_check on public.pos_locations is
  'MISE-005GK: pos_locations display_name length(trim) 1..200 plus ASCII control rejection under COLLATE "C".';
