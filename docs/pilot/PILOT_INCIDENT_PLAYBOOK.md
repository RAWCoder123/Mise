# First restaurant incident playbook

Safety order: stop the narrow external action, preserve evidence, determine the
provider outcome, then recover. Never delete audit, send-claim, authority, or
purchase-decision rows to make a retry possible.

## First response

1. Record UTC time, restaurant UUID, user, app release, order/integration ID,
   visible message, and whether the operator tapped Send.
2. Read the current controls:

   ```bash
   npm run pilot:controls -- \
     --restaurant-id <restaurant-uuid> \
     --action status \
     --confirm-project-ref <staging-project-ref>
   ```

3. Stop only the affected path:

   ```bash
   # Stop supplier delivery; drafts remain readable.
   npm run pilot:controls -- --restaurant-id <restaurant-uuid> \
     --action disable-gmail-delivery --apply --confirm-project-ref <staging-project-ref>

   # Stop new authoritative drafts.
   npm run pilot:controls -- --restaurant-id <restaurant-uuid> \
     --action disable-order-drafting --apply --confirm-project-ref <staging-project-ref>

   # Stop Square sync and webhook work for this tenant.
   npm run pilot:controls -- --restaurant-id <restaurant-uuid> \
     --action disable-square --apply --confirm-project-ref <staging-project-ref>

   # Close every external tenant gate at once.
   npm run pilot:controls -- --restaurant-id <restaurant-uuid> \
     --action disable-external --apply --confirm-project-ref <staging-project-ref>
   ```

4. If multiple tenants or an unknown provider incident are involved, pause all
   integrations with the append-only system-mode boundary:

   ```bash
   npm run pilot:controls -- --restaurant-id <restaurant-uuid> \
     --action pause-integrations --apply --confirm-project-ref <staging-project-ref>
   ```

   The app remains readable. Resume normal only after diagnosis and a recorded
   decision using `--action resume-normal`.

## Square

- **Connection/callback failed:** leave sync off; verify callback URL, Square
  environment, scopes, app return URI, and Edge logs. Reconnect from Settings → POS.
- **Token expired/refresh rejected:** disable Square, disconnect/reconnect, then
  run a fresh exact 28-day sync. Old authority must not be treated as current.
- **Full sync failed:** inspect `sales_imports`, integration state, active
  locations, Edge security events, and scrubbed Sentry event. Retry only the
  same bounded full window after the cause is corrected.
- **Webhook failed:** keep webhooks off. Manual full sync remains the authority
  path. A two-day webhook refresh must never attest a full window.
- **Mapping/catalog changed:** stop approval, resolve the mapping queue, review
  recipes, reconfirm revisions, count if needed, and re-evaluate.

## Gmail and supplier delivery

- **Definitive provider rejection:** delivery is `failed`; correct Gmail auth,
  recipient, or content, refresh preview, reapprove the exact fingerprint, then
  make one deliberate retry.
- **In progress:** wait and refresh Order detail. Do not tap Send again.
- **Unknown result / timeout after request:** disable Gmail delivery. Treat the
  message as possibly sent. Check Gmail Sent and the supplier/test inbox using
  claimed recipient, subject, timestamp, and provider message evidence. Do not
  auto-retry or force the order back to draft.
- **Gmail accepted but DB finalization failed:** handle exactly like unknown.
  Preserve the immutable claim and provider response evidence; reconcile through
  a reviewed forward repair, never a second email.
- **Recipient changed during claim:** the immutable claim remains addressed to
  the previously reviewed recipient. Inform the operator and do not redirect it.
- **Duplicate suspected:** keep Gmail disabled and compare durable delivery
  claims/provider IDs before contacting the supplier.

## Evidence to inspect

Use tenant-scoped app screens first, then Supabase logs/table viewer with a
server-authorized founder account. Never paste credentials or raw OAuth payloads
into tickets.

- restaurant/user membership and app release;
- `pos_integrations`, `pos_locations`, latest full/partial `sales_imports`;
- mapping review queue and current recipe confirmations;
- latest approved inventory count and projection events;
- recommendation authority blocker codes and draft purchase authority;
- supplier order status and exact send preview version/fingerprint;
- private supplier email delivery status, immutable claim, and safe error code;
- `audit_logs` and Edge function security events;
- latest `purchase_decision_events` sequence for the affected recommendation.

## Application rollback

1. Disable the affected external gates before changing the app build.
2. Stop TestFlight distribution of the bad candidate and restore the last
   previously approved build to pilot devices. Record both build IDs and commits.
3. Do not roll database migrations backward in place. Preserve immutable events
   and use an additive forward repair after staging proof.
4. If a data restore is unavoidable, restore a managed backup into an isolated
   project first and reconcile provider outcomes before promotion.
5. Re-run the focused scenario and full gate. Resume only the minimum control.

Purchase-decision history is append-only. Undo/exclusion creates compensating
evidence; incident response must not rewrite or erase the original decision.
