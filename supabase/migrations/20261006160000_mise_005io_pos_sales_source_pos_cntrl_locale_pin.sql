-- MISE-005IO: pin public.pos_sales.source_pos length + cntrl CHECK to COLLATE "C".
--
-- public.pos_sales was declared with an unbound source_pos column
-- (secure multi-tenant RLS foundation 202606210001):
--   source_pos text not null default 'Demo POS'
-- No table CHECK ever bounded length or rejected control characters.
-- Sibling tip MISE-005BL (#472) pinned source_record_id length + COLLATE C
-- cntrl on the same UNIQUE (restaurant_id, source_pos, source_record_id)
-- sale-identity key, but left source_pos itself unbound. MISE-005I (#417)
-- pinned provider_catalog_item_id / provider_location_id /
-- provider_variation_id; MISE-005GA (#591) / MISE-005GD (#594) pinned
-- item_name / category — source_pos remained foundation-unbound.
--
-- source_pos is the durable POS provider label half of sale replay identity
-- (values such as 'Square', 'Demo POS', 'Manual CSV Upload'). Authenticated
-- clients hold SELECT only; inserts come from SECURITY DEFINER Square sync /
-- setup / demo paths that btrim or hardcode the label. POSIX character classes
-- follow database LC_CTYPE. This cluster runs libc en_US.UTF-8. MISE-005A
-- proved locale drift on this cluster.
--
-- If LC_CTYPE drifted under a missing cntrl/length gate, dump/restore could
-- accept sale-identity provider labels the restored C-locale sibling gates
-- (#472 source_record_id, #417 provider ids) would refuse — or the reverse —
-- breaking POS sale replay / recipe depletion continuity across restore.
--
-- Scope:
--   - Attach pos_sales_source_pos_check as length(trim) 1..80 plus ASCII
--     control rejection under COLLATE "C" (matches inventory_events.source
--     length class; known writers use short fixed labels)
-- Does NOT rewrite Square sync / save_restaurant_setup / prepare_square
-- writers, source_record_id (#472), provider-identity CHECKs (#417),
-- item_name/category tips, or inventory_events.
-- Timestamp after MISE-005IN (#656).

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.pos_sales'::regclass
      and con.contype = 'c'
      and (
        con.conname = 'pos_sales_source_pos_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%source_pos%'
          and (
            pg_get_constraintdef(con.oid) ilike '%length%source_pos%'
            or pg_get_constraintdef(con.oid) ilike '%[[:cntrl:]]%'
          )
          and pg_get_constraintdef(con.oid) not ilike '%source_record_id%'
          and pg_get_constraintdef(con.oid) not ilike '%provider_%'
        )
      )
    order by con.conname
  loop
    execute format(
      'alter table public.pos_sales drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table public.pos_sales
  drop constraint if exists pos_sales_source_pos_check;

alter table public.pos_sales
  add constraint pos_sales_source_pos_check check (
    pg_catalog.length(pg_catalog.btrim(source_pos)) between 1 and 80
    and source_pos collate "C" !~ '[[:cntrl:]]'
  );

comment on constraint pos_sales_source_pos_check
  on public.pos_sales is
  'MISE-005IO: source_pos length(btrim) 1–80 plus ASCII control rejection under COLLATE "C".';
