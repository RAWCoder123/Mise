-- MISE-005EK: pin public.restaurants.address and cuisine_type CHECKs to
-- reject control characters under COLLATE "C".
--
-- restaurants_address_length_check and restaurants_cuisine_type_length_check
-- only enforced length bounds. They had no control-character gate. Bare
-- POSIX [[:cntrl:]] follows database LC_CTYPE; this cluster runs libc
-- en_US.UTF-8. MISE-005A proved locale drift on this cluster; sibling
-- restaurant and purchase-line tips re-pin text CHECKs with
-- `collate "C" !~ '[[:cntrl:]]'`.
--
-- Address and cuisine_type are durable restaurant profile fields. If
-- LC_CTYPE drifted under a bare (or missing) cntrl gate, dump/restore
-- could accept profile bytes a restored C-locale path would refuse — or
-- the reverse — breaking profile continuity across restore.
--
-- Scope:
--   - Reattach both length CHECKs preserving the exact length bounds PLUS
--     ASCII control rejection under COLLATE "C"
-- Does NOT rewrite private.update_restaurant_profile, name (#548),
-- logo_url (#437), service_style (#544), timezone (#462), or
-- operator_note / insights_content_bounds.
-- Timestamp after MISE-005EJ (#548).

alter table public.restaurants
  drop constraint if exists restaurants_address_length_check;

alter table public.restaurants
  add constraint restaurants_address_length_check check (
    address is null
    or (
      pg_catalog.length(address) <= 500
      and address collate "C" !~ '[[:cntrl:]]'
    )
  );

comment on constraint restaurants_address_length_check on public.restaurants is
  'MISE-005EK: restaurant address length <= 500 plus ASCII control rejection under COLLATE "C".';

alter table public.restaurants
  drop constraint if exists restaurants_cuisine_type_length_check;

alter table public.restaurants
  add constraint restaurants_cuisine_type_length_check check (
    cuisine_type is null
    or (
      pg_catalog.length(cuisine_type) <= 120
      and cuisine_type collate "C" !~ '[[:cntrl:]]'
    )
  );

comment on constraint restaurants_cuisine_type_length_check on public.restaurants is
  'MISE-005EK: restaurant cuisine_type length <= 120 plus ASCII control rejection under COLLATE "C".';
