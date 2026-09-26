-- MISE-005I: pin pos_sales provider-identity cntrl CHECKs to COLLATE "C".
--
-- public.pos_sales provider identity columns (MISE-002A) still reject control
-- characters with bare POSIX [[:cntrl:]], which follows database LC_CTYPE.
-- This cluster runs libc en_US.UTF-8. MISE-005A already proved locale drift on
-- this cluster for lower() / [[:alnum:]]; MISE-005B / MISE-005F / MISE-005H
-- re-pinned suppliers.display_name, purchase_lines text columns, and
-- purchase_decision_events.recommendation_unit with
-- `collate "C" !~ '[[:cntrl:]]'`.
--
-- Provider catalog / location / variation IDs are the authoritative bridge from
-- POS sales to recipe depletion. If a glibc/ICU change reclassified a stored
-- byte under bare [[:cntrl:]], pg_dump/restore would reject rows the source
-- accepted. Those identity-bearing sales rows cannot be repaired casually
-- without disturbing depletion history.
--
-- Scope:
--   - Reattach the three provider-identity CHECKs with
--     `<column> collate "C" !~ '[[:cntrl:]]'`
-- Does NOT rewrite ingest / authority-correction wrappers (compose with open
-- POS sync and purchase-authority stacks). Restore authority is the CHECK.

alter table public.pos_sales
  drop constraint if exists pos_sales_provider_catalog_item_id_check;

alter table public.pos_sales
  add constraint pos_sales_provider_catalog_item_id_check
    check (
      provider_catalog_item_id is null
      or (
        length(provider_catalog_item_id) between 1 and 128
        and provider_catalog_item_id collate "C" !~ '[[:cntrl:]]'
      )
    );

alter table public.pos_sales
  drop constraint if exists pos_sales_provider_location_id_check;

alter table public.pos_sales
  add constraint pos_sales_provider_location_id_check
    check (
      provider_location_id is null
      or (
        length(provider_location_id) between 1 and 128
        and provider_location_id collate "C" !~ '[[:cntrl:]]'
      )
    );

alter table public.pos_sales
  drop constraint if exists pos_sales_provider_variation_id_check;

alter table public.pos_sales
  add constraint pos_sales_provider_variation_id_check
    check (
      provider_variation_id is null
      or (
        length(provider_variation_id) between 1 and 128
        and provider_variation_id collate "C" !~ '[[:cntrl:]]'
      )
    );

comment on constraint pos_sales_provider_catalog_item_id_check
  on public.pos_sales is
  'MISE-005I: provider_catalog_item_id length 1–128 and ASCII C [[:cntrl:]] rejection (COLLATE "C").';

comment on constraint pos_sales_provider_location_id_check
  on public.pos_sales is
  'MISE-005I: provider_location_id length 1–128 and ASCII C [[:cntrl:]] rejection (COLLATE "C").';

comment on constraint pos_sales_provider_variation_id_check
  on public.pos_sales is
  'MISE-005I: provider_variation_id length 1–128 and ASCII C [[:cntrl:]] rejection (COLLATE "C").';
