# MISE-005W: pin save_restaurant_setup supplier discovery to COLLATE C

Date: 2026-09-26  
Branch: `cursor/mise-save-restaurant-setup-supplier-cntrl-locale-pin`  
Base: `origin/main` @ `78da737`

## Summary

Rewrite `public.save_restaurant_setup` so day-0 supplier discovery preflights use C-locale control-character, mailbox-shape, and email-lower semantics:

- `coalesce(payload.display_name, '') collate "C" ~ '[[:cntrl:]]'`
- `lower(btrim(payload.email) collate "C") collate "C"`
- `payload.email collate "C" ~ '[[:cntrl:]]'`
- `payload.email collate "C" !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'`

Preserve revoke + grant EXECUTE to `authenticated` only.

## Why

Bare POSIX `[[:cntrl:]]` / `[[:space:]]` and bare `lower()` follow database `LC_CTYPE`. MISE-005A proved locale drift on this cluster; MISE-005B/005V/005K/005N pinned suppliers CHECKs, create/rename mutators, and recipient upsert paths. Setup discovery still inserted into those tables through unpinned preflights, so ctype drift could accept bytes a restored C-locale CHECK would reject (or refuse ones it would accept).

## Out of scope

- Landing/rebasing open stacks #348–#430
- Reattaching suppliers / supplier_recipients CHECKs
- Rewriting create/rename suppliers or `ingest_purchase_lines`
- Envelope approval leftovers already covered by open #418–#425
- `realtime.to_regrole` audit
- Inventing MOQ / lead_time / expiration

## Verification

- `npm run typecheck`
- focused `tests/saveRestaurantSetupSupplierCntrlLocalePin.test.ts`
- `npm test`
- pgTAP fixture committed (`supabase/tests/database/save_restaurant_setup_supplier_cntrl_locale_pin.test.sql`); Docker/pgTAP may be unavailable in cloud agents

## Compose

Must apply after MISE-003C. Prefer after MISE-005V (#430) / MISE-005N (#422). Timestamp `20260926170000` is after 005V. Compose-safe alone on main (`save_restaurant_setup` unreplaced since 003c).
