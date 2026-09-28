-- MISE-005BE: pin public.pos_locations.external_location_id shape CHECK to
-- COLLATE "C".
--
-- public.pos_locations.external_location_id is still unbound text (NOT NULL +
-- unique with restaurant/integration only). Writers truncate with left(..., 128)
-- but never reject control characters, spaces, or non-ASCII bytes. The matching
-- sale-side identity on public.pos_sales.provider_location_id already has a
-- length + cntrl CHECK (MISE-002A; open #417 re-pins cntrl under COLLATE "C"),
-- so location rows and sale rows can disagree under dump/restore if LC_CTYPE
-- drifts.
--
-- external_location_id is the durable Square (and future POS) location key
-- used for sync filters, recipe-mapping joins, and purchase-authority
-- location resolution. Square issues opaque ASCII location tokens
-- (alphanumeric, with optional `_` / `-`), matching merchant_id shape
-- (MISE-005AZ / #460). Demo and pgTAP fixtures already use that class
-- (`demo-location`, `location_1`, `loc-a`).
--
-- This cluster runs libc en_US.UTF-8. MISE-005A proved locale drift on this
-- cluster; later 005* tips pinned merchant_id (#460) and Gmail
-- provider_subject (#464), but left pos_locations.external_location_id with
-- no shape CHECK because open #236 owns location authorize/pause writers and
-- open #460/#236 both rewrite service_complete_square_oauth.
--
-- If LC_CTYPE drifted with no shape CHECK, dump/restore could accept a
-- location identity the restored C-locale ASCII gate would refuse (or the
-- reverse), breaking POS sync location filters and sale→location joins
-- across restore.
--
-- Scope:
--   - Add named shape CHECK:
--     external_location_id collate "C" ~ '^[A-Za-z0-9_-]{1,128}$'
--   - Does NOT rewrite private.service_complete_square_oauth (open #236 /
--     #460 own that function). Edge square-oauth-callback fail-closes by
--     filtering location payloads to the same ASCII class before the
--     complete RPC; a follow-up after #236+#460 land can pin the SQL writer
--     gate.
-- Does NOT rewrite pos_sales.provider_location_id (#417), merchant_id (#460),
-- set_pos_location_status (#236), display_name / timezone free-form fields,
-- or activity_events / restaurant_memories / inventory_events.
-- Timestamp after MISE-005BD (#464 gmail provider_subject).

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
        con.conname = 'pos_locations_external_location_id_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%external_location_id%'
          and (
            pg_get_constraintdef(con.oid) ilike '%length(external_location_id)%'
            or pg_get_constraintdef(con.oid) ilike '%^[A-Za-z0-9_-]{1,128}$%'
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
  drop constraint if exists pos_locations_external_location_id_check;

alter table public.pos_locations
  add constraint pos_locations_external_location_id_check check (
    external_location_id collate "C" ~ '^[A-Za-z0-9_-]{1,128}$'
  );

comment on constraint pos_locations_external_location_id_check
  on public.pos_locations is
  'MISE-005BE: ASCII POS external_location_id under COLLATE "C".';
