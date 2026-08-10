# Drop orphan operational write RLS policies

Date: 2026-08-10  
Branch: `cursor/mise-product-inspection-f2c9`

## Gap

`inventory_items`, `menu_item_ingredients`, `pos_sales`, and `setup_attachments`
already had authenticated DML grants revoked, but twelve INSERT/UPDATE/DELETE
RLS policies remained. A later grant regression would have reopened direct
Data API writes past Edge/RPC authority.

## Fix

- Migration `20260810122000_drop_orphan_operational_write_policies.sql`
- Expand `selectOnlyAuthenticatedTables` in `security-backend.mjs`
- pgTAP + unit pins

## Verification

- `npm run typecheck`
- `npm test`
- `npm run security:backend`
- `npm run design:static`
- `npm run qa:routes`
