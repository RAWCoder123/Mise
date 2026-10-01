-- MISE-005EF: pin public.restaurants.service_style CHECK to COLLATE "C",
-- preserving the exact-token allowlist.
--
-- public.restaurants stores service_style under a bare IN allowlist from
-- restaurant_ops_backbone:
--   service_style in (
--     'quick_service', 'fast_casual', 'full_service', 'bar', 'cafe', 'ghost_kitchen'
--   )
-- That allowlist is exact string equality and carries no dedicated ASCII
-- shape gate under COLLATE "C". Writers mint durable ASCII tokens only:
--   'quick_service'  — QSR / counter service
--   'fast_casual'    — fast casual (default)
--   'full_service'   — table service
--   'bar'            — bar-forward service
--   'cafe'           — cafe service
--   'ghost_kitchen'  — delivery-only / virtual kitchen
--
-- service_style is tenant identity used by profile patches, operational
-- profile consistency, and setup presentation. POSIX character classes follow
-- database LC_CTYPE. This cluster runs libc en_US.UTF-8. MISE-005A proved
-- locale drift on this cluster; open tip #543 pinned setup_attachments
-- kind/status, but leave restaurants.service_style on bare IN only.
--
-- If LC_CTYPE drifted under a bare-IN service_style CHECK, dump/restore could
-- accept service-style vocabulary bytes the restored C-locale path (and
-- sibling machine-identity gates) would refuse — or the reverse — breaking
-- restaurant identity continuity across restore.
--
-- Scope:
--   - Replace restaurants_service_style_check with exact-token allowlist PLUS
--     ASCII shape under COLLATE "C"
-- Does NOT rewrite update_restaurant_profile / service_style patch writers,
-- brand_color/accent_color CHECKs, setup_attachments (#543), or pilot pins
-- (#542/#541). Timestamp after MISE-005EE (#543).

alter table public.restaurants
  drop constraint if exists restaurants_service_style_check;

alter table public.restaurants
  add constraint restaurants_service_style_check
  check (
    service_style in (
      'quick_service',
      'fast_casual',
      'full_service',
      'bar',
      'cafe',
      'ghost_kitchen'
    )
    and service_style collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint restaurants_service_style_check
  on public.restaurants is
  'MISE-005EF: exact quick_service/fast_casual/full_service/bar/cafe/ghost_kitchen allowlist plus ASCII shape under COLLATE "C". Restaurant service style identity.';

comment on column public.restaurants.service_style is
  'Restaurant service style. Allowed values: quick_service, fast_casual, full_service, bar, cafe, ghost_kitchen under COLLATE "C".';
