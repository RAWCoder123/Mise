# Security gate allowlist refresh + setup skip surfacing

Date: 2026-08-01
Branch: `cursor/mise-product-inspection-3408`
Base tip: `e2bb24f` (fast-forwarded from `cursor/mise-product-inspection-81cb`)

## Completed

1. **pgTAP public/private allowlists** now include July/August tables:
   - public: `inventory_count_sessions`, `inventory_count_lines`, `storage_locations`, `inventory_location_balances`, `restaurant_member_invites`
   - private: `gmail_oauth_flows`, `gmail_credentials`, `supplier_email_deliveries`
2. **Privilege asserts** cover UPDATE/DELETE denial for secondary service-owned tables and SELECT-only access for count/storage tables; member invites remain Data-API opaque.
3. **Cross-tenant INSERT/UPDATE/DELETE probes** added for count sessions/lines, storage locations, and location balances with deterministic fixtures.
4. **`security-static.mjs` restaurant-owned catalog** aligned with `security-backend.mjs` for count session/line tables.
5. **Staging seed + tenant check** seed and probe the same post-July-18 restaurant-owned surfaces.
6. **Setup ready screen** surfaces `skippedRecipeIngredients` with a Review recipes CTA (EN/ES/zh-Hans).
7. **Local Auth redirect allowlist** includes `mise://reset-password`, `mise://invite`, and Expo local schemes; hosted Auth UI still requires founder mirror.

## Verification

- `npm run typecheck`
- `npm test`
- `npm run security:static`
- `npm run design:static`

Docker/pgTAP execution and hosted staging re-proof remain environment-blocked in this workspace.

## Classification impact

Still **controlled pilot-ready code** pending Docker + hosted security gate re-run. Not App Store submission-ready.
