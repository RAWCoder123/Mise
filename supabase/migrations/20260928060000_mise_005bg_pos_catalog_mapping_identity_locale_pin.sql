-- MISE-005BG: pin public.pos_catalog_item_mappings external identity CHECKs
-- to COLLATE "C".
--
-- public.pos_catalog_item_mappings.external_catalog_item_id and
-- external_variation_id are still unbound text (NOT NULL; variation defaults
-- to ''). Sync writers truncate with left(..., 128) but never reject control
-- characters. The matching sale-side identity on
-- public.pos_sales.provider_catalog_item_id / provider_variation_id already
-- has length + cntrl CHECKs (MISE-002A; open #417 re-pins cntrl under
-- COLLATE "C"), so mapping rows and sale rows can disagree under dump/restore
-- if LC_CTYPE drifts.
--
-- These columns are the durable Square (and future POS) catalog join keys
-- used for recipe-mapping verification, purchase-authority depletion, and
-- POS sync upsert conflict targets. Demo and pgTAP fixtures already use
-- printable ASCII tokens (`ITEM-A`, `VAR-A`, `ITEM-VERIFY`).
--
-- external_variation_id uses '' (not NULL) as the "no variation" sentinel,
-- matching sync writers that store left(coalesce(..., ''), 128). The CHECK
-- must allow empty string while still bounding non-empty values.
--
-- This cluster runs libc en_US.UTF-8. MISE-005A proved locale drift on this
-- cluster; later 005* tips pinned sale provider identity (#417) and location
-- external ids (#465/#466), but left catalog mapping identity with no shape
-- CHECK because open POS sync / mapping-review stacks own the upsert writers.
--
-- If LC_CTYPE drifted with no shape CHECK, dump/restore could accept a
-- mapping identity the restored C-locale sale path would refuse (or the
-- reverse), breaking sale→mapping→recipe depletion joins across restore.
--
-- Scope:
--   - Add named length + cntrl CHECKs under COLLATE "C" for
--     external_catalog_item_id and external_variation_id.
--   - Does NOT rewrite Square sync upsert / mapping-review RPCs (open POS
--     sync and purchase-authority stacks own those).
-- Does NOT rewrite pos_sales provider identity (#417), pos_locations /
-- pos_integrations external_location_id (#465/#466), modifier_recipe_adjustments
-- external_modifier_id, external_name free-form display, or
-- activity_events / restaurant_memories / inventory_events.
-- Timestamp after MISE-005BF (#466 pos_integrations.external_location_id).

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.pos_catalog_item_mappings'::regclass
      and con.contype = 'c'
      and (
        con.conname in (
          'pos_catalog_item_mappings_external_catalog_item_id_check',
          'pos_catalog_item_mappings_external_variation_id_check'
        )
        or (
          pg_get_constraintdef(con.oid) ilike '%external_catalog_item_id%'
          and (
            pg_get_constraintdef(con.oid) ilike '%length(external_catalog_item_id)%'
            or pg_get_constraintdef(con.oid) ilike '%[[:cntrl:]]%'
          )
        )
        or (
          pg_get_constraintdef(con.oid) ilike '%external_variation_id%'
          and (
            pg_get_constraintdef(con.oid) ilike '%length(external_variation_id)%'
            or pg_get_constraintdef(con.oid) ilike '%[[:cntrl:]]%'
          )
        )
      )
    order by con.conname
  loop
    execute format(
      'alter table public.pos_catalog_item_mappings drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table public.pos_catalog_item_mappings
  drop constraint if exists pos_catalog_item_mappings_external_catalog_item_id_check;

alter table public.pos_catalog_item_mappings
  add constraint pos_catalog_item_mappings_external_catalog_item_id_check
    check (
      length(external_catalog_item_id) between 1 and 128
      and external_catalog_item_id collate "C" !~ '[[:cntrl:]]'
    );

alter table public.pos_catalog_item_mappings
  drop constraint if exists pos_catalog_item_mappings_external_variation_id_check;

alter table public.pos_catalog_item_mappings
  add constraint pos_catalog_item_mappings_external_variation_id_check
    check (
      external_variation_id = ''
      or (
        length(external_variation_id) between 1 and 128
        and external_variation_id collate "C" !~ '[[:cntrl:]]'
      )
    );

comment on constraint pos_catalog_item_mappings_external_catalog_item_id_check
  on public.pos_catalog_item_mappings is
  'MISE-005BG: external_catalog_item_id length 1–128 and ASCII C [[:cntrl:]] rejection (COLLATE "C"); sale-side join parity with pos_sales.provider_catalog_item_id.';

comment on constraint pos_catalog_item_mappings_external_variation_id_check
  on public.pos_catalog_item_mappings is
  'MISE-005BG: external_variation_id empty sentinel or length 1–128 with ASCII C [[:cntrl:]] rejection (COLLATE "C"); sale-side join parity with pos_sales.provider_variation_id.';
