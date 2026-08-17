# Gmail supplier-email backend

Mise uses a server-side Google OAuth authorization-code flow for restaurant Gmail senders. Expo receives only safe connection metadata and the Google authorization URL; it never receives the Google client secret, refresh credential, or an access token.

## Google and Supabase configuration

1. Enable the Gmail API in a dedicated Google Cloud project and configure an OAuth web application.
2. Register the exact HTTPS Edge Function callback URL as the Google redirect URI:

   `https://<project-ref>.supabase.co/functions/v1/gmail-oauth-callback`

3. Configure these backend-only Edge Function secrets:

   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI`
   - `MISE_APP_GMAIL_REDIRECT_URI` (optional fixed HTTPS or `mise:` return URL)
   - `GMAIL_MESSAGE_ID_DOMAIN` (optional; defaults to `mail.mise.app`)
   - `GMAIL_SEND_ENABLED=true` only after an approved test account, recipient, consent screen, and staging review are ready

4. Apply `20260719062148_gmail_backend_oauth_delivery.sql`. It enables Supabase Vault, removes client mutation access to connection state, and installs the actor-bound OAuth/delivery RPCs.

Mise requests `openid`, `email`, and only the Gmail `gmail.send` authorization scope. Access tokens remain in Edge Function memory. Refresh credentials and single-use PKCE verifiers are stored in Supabase Vault; their private metadata tables have RLS enabled and no client grants.

## Function contracts

`link-gmail` requires an authenticated owner/admin and a JSON body with `restaurantId`.

- Connect (default): returns `{ status: "authorization_required", authorizationUrl, expiresAt }`.
- Disconnect: pass `{ restaurantId, action: "disconnect" }`; Google revocation must succeed (or report an already-invalid token) before local credentials are removed.

`gmail-oauth-callback` is the only function with JWT verification disabled. It accepts Google `GET` callbacks, then atomically hashes and claims a ten-minute, single-use state record tied to the initiating actor, tenant, PKCE verifier, and reserved firewall event. It never renders the authorization code or loads third-party page resources.

`send-supplier-email` requires an authenticated owner/admin/manager and `{ restaurantId, orderId }`.

- A successful provider response returns `{ status: "sent", outcome, providerMessageId, order, orderedRecommendations }`.
- `gmail_not_connected`, `needs_reauth`, and missing/invalid supplier-recipient states are actionable conflicts.
- `delivery_requires_review` means the provider outcome was ambiguous. Mise does not automatically retry that order, preventing duplicate supplier email.
- Managers can inspect the bounded review state with `get_supplier_email_delivery_review` and resolve it with `resolve_supplier_email_delivery`:
  - `confirm_sent` records the order as sent after explicit confirmation (optional provider message id, otherwise a manager attestation id).
  - `allow_retry` marks the ambiguous claim failed and returns the send action to a re-approvable failed state so one deliberate resend can proceed after envelope review.
- The order becomes `sent`, linked recommendations become `ordered`, the provider message ID is persisted, and audit evidence is created in one database transaction only after Gmail accepts the message, or after a manager confirms an ambiguous outcome.

The database rejects direct hosted calls that try to mark a supplier order sent before provider acceptance. Local demo workflows remain independent of Google credentials.

## Verification

Mocked provider tests do not contact Google or send mail:

```bash
node --test --import tsx tests/gmailBackend.test.ts
npm run security:backend
npm run supabase:test
```

The last command requires Docker Desktop. Live OAuth and delivery verification additionally require an explicitly approved Google test user and recipient; do not enable `GMAIL_SEND_ENABLED` merely to exercise automated tests.

Implementation references: [Google OAuth web-server flow](https://developers.google.com/identity/protocols/oauth2/web-server), [Google OAuth security practices](https://developers.google.com/identity/protocols/oauth2/resources/best-practices), [Gmail `users.messages.send`](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/send), [Gmail MIME sending guide](https://developers.google.com/workspace/gmail/api/guides/sending), [Supabase Vault](https://supabase.com/docs/guides/database/vault), and [Supabase Edge Function configuration](https://supabase.com/docs/guides/functions/function-configuration).
