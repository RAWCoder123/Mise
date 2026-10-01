-- MISE-005EJ: pin public.restaurants.name CHECK to reject control
-- characters under COLLATE "C".
--
-- restaurants_name_length_check only enforced length(trim(name)) between
-- 1 and 120. It had no control-character gate. Bare POSIX [[:cntrl:]]
-- follows database LC_CTYPE; this cluster runs libc en_US.UTF-8.
-- MISE-005A proved locale drift on this cluster; sibling supplier and
-- purchase-line tips re-pin text CHECKs with `collate "C" !~ '[[:cntrl:]]'`.
--
-- Restaurant name is durable tenant identity. If LC_CTYPE drifted under a
-- bare (or missing) cntrl gate, dump/restore could accept name bytes a
-- restored C-locale path would refuse — or the reverse — breaking
-- restaurant identity continuity across restore.
--
-- Scope:
--   - Reattach restaurants_name_length_check preserving the exact length
--     bound PLUS ASCII control rejection under COLLATE "C"
-- Does NOT rewrite private.create_restaurant_with_owner, address/cuisine
-- CHECKs, logo_url shape, service_style (#544), or timezone (#462).
-- Timestamp after MISE-005EI (#547).

alter table public.restaurants
  drop constraint if exists restaurants_name_length_check;

alter table public.restaurants
  add constraint restaurants_name_length_check check (
    pg_catalog.length(pg_catalog.btrim(name)) between 1 and 120
    and name collate "C" !~ '[[:cntrl:]]'
  );

comment on constraint restaurants_name_length_check on public.restaurants is
  'MISE-005EJ: restaurant name length 1..120 after trim plus ASCII control rejection under COLLATE "C".';
