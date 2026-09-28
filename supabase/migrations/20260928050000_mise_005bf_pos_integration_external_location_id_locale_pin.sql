-- MISE-005BF: pin public.pos_integrations.external_location_id shape CHECK to
-- COLLATE "C" (NULL allowed).
--
-- public.pos_integrations.external_location_id is still unbound nullable text
-- (created in restaurant_ops_backbone with no length or charset CHECK). It is
-- the primary-location snapshot written by private.service_complete_square_oauth
-- via nullif(trim(...), '') — empty becomes NULL, otherwise the raw provider
-- token is stored. Sibling public.pos_locations.external_location_id is pinned
-- under COLLATE "C" ASCII shape by MISE-005BE / open #465; the integration
-- snapshot stayed unbound so a dump/restore under drifted LC_CTYPE could accept
-- a primary location identity the restored C-locale location gate (and Edge
-- ASCII filter on #465) would refuse, or the reverse.
--
-- external_location_id on the integration row is the durable "primary" Square
-- (and future POS) location key used when a connection has a preferred location
-- before finer pos_locations authorization. Square issues opaque ASCII location
-- tokens (alphanumeric, with optional `_` / `-`), matching merchant_id and
-- pos_locations.external_location_id shape (MISE-005AZ / #460, MISE-005BE /
-- #465). Demo and pgTAP fixtures already use that class (`demo-location`,
-- `demo-square-location`) or NULL when disconnected.
--
-- This cluster runs libc en_US.UTF-8. MISE-005A proved locale drift on this
-- cluster; later 005* tips pinned merchant_id (#460) and pos_locations
-- external_location_id (#465), but left the integration snapshot unbound
-- because open #236/#460 rewrite service_complete_square_oauth.
--
-- If LC_CTYPE drifted with no shape CHECK, dump/restore could accept a primary
-- location identity the restored C-locale ASCII gate would refuse (or the
-- reverse), breaking reconnect continuity and any path that trusts the
-- integration snapshot as the active location key.
--
-- Scope:
--   - Add named nullable shape CHECK:
--     external_location_id is null
--     or external_location_id collate "C" ~ '^[A-Za-z0-9_-]{1,128}$'
--   - Does NOT rewrite private.service_complete_square_oauth (open #236 /
--     #460 own that function). Edge square-oauth-callback primary-location
--     filtering lands with MISE-005BE / #465 (acceptedLocations[0]); a
--     follow-up after #236+#460+#465 land can pin the SQL writer gate.
-- Does NOT rewrite pos_locations (#465), pos_sales.provider_location_id (#417),
-- merchant_id (#460), set_pos_location_status (#236), display_name / timezone
-- free-form fields, or activity_events / restaurant_memories / inventory_events.
-- Timestamp after MISE-005BE (#465 pos_locations.external_location_id).

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.pos_integrations'::regclass
      and con.contype = 'c'
      and (
        con.conname = 'pos_integrations_external_location_id_check'
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
      'alter table public.pos_integrations drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table public.pos_integrations
  drop constraint if exists pos_integrations_external_location_id_check;

alter table public.pos_integrations
  add constraint pos_integrations_external_location_id_check check (
    external_location_id is null
    or external_location_id collate "C" ~ '^[A-Za-z0-9_-]{1,128}$'
  );

comment on constraint pos_integrations_external_location_id_check
  on public.pos_integrations is
  'MISE-005BF: ASCII POS primary external_location_id under COLLATE "C" (NULL when disconnected).';
