# 2026-08-01 — Recipe coverage, settings list, and final security gates

Branch: `cursor/mise-product-inspection-45f5` (fast-forwarded from `cursor/mise-product-inspection-d84d` tip `b6ace1f`).

## Why

Highest-impact implementable gaps after the receive put-away pgTAP run were:

1. Static security gates still asserted a legacy authenticated Edge reservation grant that later migrations drop.
2. Recipe settings truncated mapped menu items to 6, hiding edit/unlink for larger menus.
3. Recipe coverage used raw POS/menu names while consumption already normalized keys, causing false unmapped alerts.
4. Inventory count drafts used `Number()` and silently skipped invalid locale decimals.

## Changes

- `scripts/security-static.mjs` — final-state checks for dropped 4-arg reserve helper, service_role-only 5-arg reserve, and `setup_attachments` DML revoke.
- `services/domain/miseDomain.ts` — normalized menu-item keys for coverage; optional `itemLimit` (`null` = full list).
- `services/application/inventory.ts` + `app/settings/recipes.tsx` — recipes settings loads the full mapped list.
- `app/inventory/count.tsx` + i18n — locale-aware count parsing with explicit invalid-quantity errors.
- `scripts/mobile-route-smoke.mjs` — include `/settings/pos` and `/settings/recipes`.
- Tests covering final security posture, normalization, and full recipe list.

## Verification

- `npm run typecheck`
- `npm test`
- `npm run security:static`
- `npm run security:backend` (static portions available without Docker/staging)
