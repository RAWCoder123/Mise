-- MISE-005BO: pin public.pos_locations.timezone shape CHECK to COLLATE "C"
-- (NULL allowed).
--
-- public.pos_locations.timezone is still unbound nullable text (created in
-- operational_data_foundation_inventory_ledger with no length or charset
-- CHECK). Square OAuth completion writes it via
-- nullif(left(coalesce(location_row->>'timezone', ''), 64), ''), and the Edge
-- locations mapper currently accepts any string of length ≤ 64. The column
-- remains the durable optional IANA label for the POS location clock —
-- sale_date attribution, sync windows, and location-scoped operational time
-- math — not free-form notes.
--
-- Authenticated clients hold SELECT only on pos_locations; inserts/updates
-- come from SECURITY DEFINER Square OAuth / sync paths. Provider timezone
-- labels are printable IANA Area/Location names, not control payloads — they
-- must not carry control bytes or spaced/non-ASCII labels that could confuse
-- dumps, restores, exports, or time-boundary math.
--
-- This cluster runs libc en_US.UTF-8. MISE-005A proved locale drift on this
-- cluster. POSIX character classes follow database LC_CTYPE.
--
-- If LC_CTYPE drifted with no shape CHECK, dump/restore could accept a
-- timezone the restored C-locale gate would refuse (or the reverse),
-- breaking POS location clock continuity across restore — the same class of
-- dump/restore disagreement already closed for restaurants.timezone
-- (MISE-005BB #462) and outreach_campaigns.timezone (MISE-005BC #463).
--
-- Scope:
--   - Add named nullable CHECK:
--     timezone is null
--     or timezone collate "C" ~ '^[A-Za-z0-9/_+-]{1,64}$'
--     (same IANA Area/Location ASCII class as restaurants / outreach; length
--      bound matches Square writer left(..., 64))
-- Does NOT rewrite service_complete_square_oauth / Square sync writers
-- (contested with open #236/#460/#465 location stacks), restaurants.timezone
-- (#462), outreach_campaigns.timezone (#463), external_location_id (#465/#466),
-- or free-form display_name.
-- Timestamp after MISE-005BN (#474 sales_imports.source_file_name).

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
        con.conname = 'pos_locations_timezone_check'
        or con.conname = 'pos_locations_timezone_length_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%timezone%'
          and (
            pg_get_constraintdef(con.oid) ilike '%length%timezone%'
            or pg_get_constraintdef(con.oid) ilike '%[[:cntrl:]]%'
            or pg_get_constraintdef(con.oid) ilike '%A-Za-z0-9/_+-%'
          )
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
  drop constraint if exists pos_locations_timezone_check;

alter table public.pos_locations
  drop constraint if exists pos_locations_timezone_length_check;

alter table public.pos_locations
  add constraint pos_locations_timezone_check check (
    timezone is null
    or (
      timezone collate "C" ~ '^[A-Za-z0-9/_+-]{1,64}$'
    )
  );

comment on constraint pos_locations_timezone_check
  on public.pos_locations is
  'MISE-005BO: optional IANA-shaped ASCII timezone (Area/Location class) under COLLATE "C", length 1–64.';
