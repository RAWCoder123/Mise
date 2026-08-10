# Square POS backend

Mise uses a server-side Square OAuth authorization-code flow for restaurant POS
connections. Expo receives only safe connection metadata and the Square
authorization URL; it never receives the application secret, refresh credential,
or an access token.

## Square and Supabase configuration

1. Create a Square application (sandbox first) with OAuth redirect URI:

   `https://<project-ref>.supabase.co/functions/v1/square-oauth-callback`

2. Request scopes: `MERCHANT_PROFILE_READ`, `ITEMS_READ`, `ORDERS_READ`.

3. Configure these backend-only Edge Function secrets:

   - `SQUARE_APPLICATION_ID`
   - `SQUARE_APPLICATION_SECRET`
   - `SQUARE_REDIRECT_URI`
   - `SQUARE_ENVIRONMENT=sandbox` or `production`
   - `MISE_APP_SQUARE_REDIRECT_URI` (optional HTTPS or `mise:` return URL)
   - `SQUARE_WEBHOOK_SIGNATURE_KEY` and `SQUARE_WEBHOOK_NOTIFICATION_URL` only when enabling webhooks

4. Apply `20260730210000_square_backend_oauth_sync.sql`.

5. Keep sync and webhooks fail-closed until staging proof:

   - `system_operational_controls.square_sync_enabled = false` by default
   - `restaurant_operational_controls.square_sync_enabled = false` by default
   - matching `square_webhooks_enabled` defaults

## Function contracts

`link-square` requires an authenticated owner/admin and `{ restaurantId }`.

- Connect (default): returns `{ status: "authorization_required", authorizationUrl, expiresAt }`.
- Disconnect: pass `{ restaurantId, action: "disconnect" }`.

`square-oauth-callback` is JWT-unverified. It claims a single-use hashed state,
exchanges the code, stores the refresh token in Vault, upserts
`pos_integrations` / `pos_locations`, and returns an HTML or app redirect page.

`sync-pos-sales` with `provider: "square"` requires owner/admin/manager, Square
server configuration, a connected credential, and both system + restaurant
`square_sync_enabled`. It upserts `pos_sales` (`source_pos = 'Square'`), drafts
catalog mappings into `menu_items` / `pos_catalog_item_mappings`, writes
`sales_imports` (`import_type = pos_sync`), and best-effort refreshes operational
signals.

`square-webhooks` verifies the Square HMAC signature, requires
`square_webhooks_enabled` (system + restaurant), then runs a bounded two-day
sync for the merchant. Leave disabled until sync is proven.

## Operator path

1. Owner/admin opens Settings → POS Connection → Connect Square.
2. Approve Square scopes in the browser and return to Mise.
3. After founder/ops enable `square_sync_enabled` for that restaurant and the
   system row via service-role (clients cannot Data-API mutate provider
   controls), use Sync sales now (28-day window) or wait for webhooks.
4. Map new dishes in Recipes so sales deplete inventory projections.
5. CSV import remains available as a fallback.

## Verification

```bash
node --test --import tsx tests/squareBackend.test.ts
npm run typecheck
npm test
```

Do not enable `square_sync_enabled` or webhooks in production without sandbox
proof, mapping coverage review, and an approved merchant account.
