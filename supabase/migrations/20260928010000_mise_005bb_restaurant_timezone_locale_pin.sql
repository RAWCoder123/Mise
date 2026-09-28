-- MISE-005BB: pin public.restaurants.timezone shape CHECK to COLLATE "C".
--
-- public.restaurants.timezone still only enforces length 1–64:
--   check (pg_catalog.length(timezone) between 1 and 64)
-- Client + private.update_restaurant_profile already require a real
-- pg_timezone_names / Intl IANA name, but the table CHECK admits any Unicode
-- string of that length — including ASCII controls and spaced labels.
--
-- Under LC_CTYPE drift, dump/restore and profile patch continuity can disagree
-- on the same timezone bytes: a restore under C-locale reject classes that the
-- length-only CHECK accepted. Restaurant timezone anchors count boundaries,
-- planning snapshots, POS sale_date attribution, and Today service windows, so
-- identity drift here corrupts operational time math across tenants.
--
-- Scope:
--   - Reattach restaurants_timezone_length_check with
--     timezone collate "C" ~ '^[A-Za-z0-9/_+-]{1,64}$'
--     (IANA Area/Location ASCII class used by tzdb; length bound preserved)
-- Does NOT rewrite private.update_restaurant_profile (owned by open
-- MISE-005AB #436 / MISE-005AC #437 currency/color/logo stacks). Writer
-- pg_timezone_names compare remains for a follow-up after those land.
-- Does NOT rewrite create_restaurant_with_owner (default America/New_York),
-- outreach_campaigns.timezone, or free-form notes.
-- Timestamp after MISE-005BA (#461 staging_marker).

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.restaurants'::regclass
      and con.contype = 'c'
      and (
        con.conname = 'restaurants_timezone_length_check'
        or con.conname = 'restaurants_timezone_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%timezone%'
          and pg_get_constraintdef(con.oid) ilike '%length%timezone%'
          and pg_get_constraintdef(con.oid) not ilike '%currency%'
          and pg_get_constraintdef(con.oid) not ilike '%logo_url%'
          and pg_get_constraintdef(con.oid) not ilike '%brand_color%'
          and pg_get_constraintdef(con.oid) not ilike '%accent_color%'
          and pg_get_constraintdef(con.oid) not ilike '%operational_profile%'
        )
      )
    order by con.conname
  loop
    execute format(
      'alter table public.restaurants drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table public.restaurants
  drop constraint if exists restaurants_timezone_length_check;

alter table public.restaurants
  drop constraint if exists restaurants_timezone_check;

alter table public.restaurants
  add constraint restaurants_timezone_length_check check (
    timezone collate "C" ~ '^[A-Za-z0-9/_+-]{1,64}$'
  );

comment on constraint restaurants_timezone_length_check
  on public.restaurants is
  'MISE-005BB: IANA-shaped ASCII timezone (Area/Location class) under COLLATE "C", length 1–64.';
