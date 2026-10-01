# MISE-005EF: pin restaurants.service_style CHECK to COLLATE C

Date: 2026-10-01
Branch: `cursor/mise-restaurants-service-style-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Replace the bare-IN `public.restaurants.service_style` allowlist with the
exact-token contract plus ASCII shape under COLLATE `"C"`:

```sql
service_style in (
  'quick_service',
  'fast_casual',
  'full_service',
  'bar',
  'cafe',
  'ghost_kitchen'
)
and service_style collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
```

## Writer vocabulary

Confirmed ASCII mint (`restaurant_ops_backbone` CHECK;
`update_restaurant_profile` patch allowlist in
`harden_profile_ai_and_order_boundaries`):

- `quick_service`
- `fast_casual` (default)
- `full_service`
- `bar`
- `cafe`
- `ghost_kitchen`

Exact-token allowlist is preserved; this tip adds the COLLATE C ASCII shape
gate alongside it.

## Why

MISE-005A proved locale drift on this cluster. Open tip #543 pinned
`setup_attachments` kind/status but left `restaurants.service_style` on bare
IN. Without a dedicated COLLATE C shape CHECK, dump/restore under LC_CTYPE
drift can accept service-style vocabulary bytes the restored C-locale path
would refuse — or the reverse — breaking restaurant identity continuity across
restore.

## Scope

- CHECK-only on `public.restaurants.service_style`
- Does **not** rewrite `update_restaurant_profile` / service_style patch writers
- Does **not** touch `brand_color` / `accent_color` CHECKs
- Does **not** touch setup_attachments (#543) or pilot pins (#542/#541)
- Alone on main OK; timestamp after #543 (`20261001090000`)

## Verification

- `npm run typecheck` pass
- focused `tests/restaurantsServiceStyleLocalePin.test.ts` 3/3 pass
- `npm test` 679 pass / 0 fail / 7 cancelled
- pgTAP fixture committed (plan 14 from 14 assertion call sites); Docker/hosted
  pgTAP not run here

## Files

- `supabase/migrations/20261001100000_mise_005ef_restaurants_service_style_locale_pin.sql`
- `supabase/tests/database/restaurants_service_style_locale_pin.test.sql`
- `tests/restaurantsServiceStyleLocalePin.test.ts`
- `docs/automation-reports/2026-10-01-restaurants-service-style-locale-pin.md`
