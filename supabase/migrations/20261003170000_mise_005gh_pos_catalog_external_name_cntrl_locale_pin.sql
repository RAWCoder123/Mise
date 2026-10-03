-- MISE-005GH: pin public.pos_catalog_item_mappings.external_name CHECK to
-- reject control characters under COLLATE "C" and lock the catalog length
-- bound.
--
-- pos_catalog_item_mappings.external_name is durable NOT NULL text
-- (operational_data_foundation_inventory_ledger) with no table-level length
-- or control-character gate. Square catalog sync writers
-- (square_backend_oauth_sync and later truthful-count / POS-identity /
-- purchase-approval rewrites) persist
-- left(trim(coalesce(catalog_item->>'external_name', '')), 160) into
-- external_name and skip empty results. Bare POSIX [[:cntrl:]] follows
-- database LC_CTYPE; this cluster runs libc en_US.UTF-8. MISE-005A proved
-- locale drift on this cluster; sibling tips re-pin text CHECKs with
-- `collate "C" !~ '[[:cntrl:]]'`.
--
-- external_name is a durable single-line POS catalog item label (provider
-- catalog display name mirrored into the mapping row). It is not free-form
-- multiline prose and must not accept LF/TAB/CR/NUL. Open tip #467
-- (MISE-005BG) pinned only external_catalog_item_id / external_variation_id;
-- this tip closes the remaining ungated mapping label. If LC_CTYPE drifted
-- under a bare (or missing) cntrl gate, dump/restore could accept
-- external_name bytes a restored C-locale path would refuse — or the
-- reverse — breaking catalog-mapping continuity and sale→mapping join
-- readability across restore.
--
-- Scope:
--   - Attach pos_catalog_item_mappings_external_name_check as
--     length(trim(external_name)) between 1 and 160 PLUS ASCII control
--     rejection under COLLATE "C" (matches Square left(..., 160) writers)
--   - Dedicated CHECK so this tip stays alone-OK versus
--     pos_catalog_item_mappings identity CHECKs (#467), verification_status /
--     confidence / window CHECKs, and versus menu_items.name (#597) /
--     inventory/pos_sales/purchase/count-line stacks
-- Does NOT rewrite Square sync / POS catalog / mapping-review writers,
-- identity CHECKs (#467), menu_items.name (#597), or sibling item_name
-- stacks.
-- Timestamp after MISE-005GG (#597).

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
        con.conname = 'pos_catalog_item_mappings_external_name_check'
        or (
          pg_get_constraintdef(con.oid) ~* '\yexternal_name\y'
          and (
            pg_get_constraintdef(con.oid) ilike '%length%trim%external_name%'
            or pg_get_constraintdef(con.oid) ilike '%length(external_name)%'
            or pg_get_constraintdef(con.oid) ilike '%[[:cntrl:]]%'
          )
          and pg_get_constraintdef(con.oid) not ilike '%external_catalog_item_id%'
          and pg_get_constraintdef(con.oid) not ilike '%external_variation_id%'
          and pg_get_constraintdef(con.oid) not ilike '%verification_status%'
          and pg_get_constraintdef(con.oid) not ilike '%confidence%'
          and pg_get_constraintdef(con.oid) not ilike '%effective_to%'
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
  drop constraint if exists pos_catalog_item_mappings_external_name_check;

alter table public.pos_catalog_item_mappings
  add constraint pos_catalog_item_mappings_external_name_check check (
    length(trim(external_name)) between 1 and 160
    and external_name collate "C" !~ '[[:cntrl:]]'
  );

comment on constraint pos_catalog_item_mappings_external_name_check
  on public.pos_catalog_item_mappings is
  'MISE-005GH: pos_catalog_item_mappings external_name length(trim) 1..160 plus ASCII control rejection under COLLATE "C".';
