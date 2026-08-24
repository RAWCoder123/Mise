# First restaurant onboarding

This is the founder checklist for one controlled restaurant in hosted staging.
Keep Square webhooks and Gmail delivery off until their explicit steps. Record
the restaurant UUID once and use it for every founder command.

## Before arrival

- [ ] Exact candidate commit and TestFlight build recorded; TestFlight uses
      `EXPO_PUBLIC_APP_ENV=staging` and `EXPO_PUBLIC_ENABLE_DEMO_MODE=false`.
- [ ] Fresh migrations and the full local gate pass.
- [ ] Hosted staging is a dedicated Supabase project; its project ref is not
      the production ref.
- [ ] Required Edge Functions are deployed and staging identity preflight passes.
- [ ] Square sandbox application is available with restaurant admin access.
- [ ] Gmail test user is approved; `GMAIL_SEND_ENABLED=false` until the send test.
- [ ] Restaurant menu/export, recipes, complete inventory list, units, pars,
      suppliers, supplier emails, and physical count team are ready.
- [ ] A founder-controlled TEST recipient is agreed. Do not begin with a real
      supplier address.
- [ ] Founder has `.mise-staging.env` outside version control with the bounded
      staging variables documented in `PILOT_DEPLOYMENT.md`.

## Onboarding

1. Provision the owner. Run the dry-run first, then the staging-pinned apply:

   ```bash
   npm run beta:provision-owner -- \
     --email owner@example.com \
     --restaurant "Restaurant name" \
     --cuisine "Cuisine" \
     --idempotency-key <stable-uuid> \
     --invite-file /private/tmp/mise-owner-invite.json

   npm run beta:provision-owner -- \
     --apply \
     --confirm-project-ref <staging-project-ref> \
     --email owner@example.com \
     --restaurant "Restaurant name" \
     --cuisine "Cuisine" \
     --idempotency-key <same-stable-uuid> \
     --invite-file /private/tmp/mise-owner-invite.json
   ```

2. Deliver the protected invite out of band. The owner accepts it, sets a
   password, and opens Today. Confirm active owner membership.
3. Open the Today setup task. Enter the full first-pilot supplier and inventory
   list. Use standard units so canonical conversion is automatically verified.
   Add recipient emails only if known; they remain editable by supplier ID.
4. Save the hosted setup. Confirm real restaurant data appears in Inventory and
   local demo content does not appear.
5. Settings → POS → Connect Square. Approve only
   `MERCHANT_PROFILE_READ`, `ITEMS_READ`, and `ORDERS_READ`. Confirm the app
   returns to a connected Square state.
6. Read current controls, then enable Square sync only:

   ```bash
   npm run pilot:controls -- \
     --restaurant-id <restaurant-uuid> \
     --action status \
     --confirm-project-ref <staging-project-ref>

   npm run pilot:controls -- \
     --restaurant-id <restaurant-uuid> \
     --action enable-square-sync \
     --apply \
     --confirm-project-ref <staging-project-ref>
   ```

7. In Settings → POS, run Sync sales now. It requests the exact current
   restaurant-local 28-day window. Record processed rows, last sync, and every
   active Square location. Do not enable webhooks yet.
8. Open provider mapping review. Verify exact catalog item/variation identity;
   reject uncertainty. Continue until the queue has no relevant blockers.
9. Settings → Recipes: enter ingredient usage for the high-volume menu items,
   save compatible units, and Confirm every current recipe revision.
10. Inventory: verify every item shows a canonical unit. Start the physical
    count, enter all lines, submit, and have owner/admin/manager approve.
11. Settings → Suppliers: temporarily set the intended supplier's recipient to
    the founder-controlled TEST address.
12. Settings → Gmail: connect the approved test sender. Confirm the exact sender
    address. Keep delivery controls off.
13. Enable server-authoritative draft creation:

    ```bash
    npm run pilot:controls -- \
      --restaurant-id <restaurant-uuid> \
      --action enable-order-drafting \
      --apply \
      --confirm-project-ref <staging-project-ref>
    ```

14. Confirm purchase readiness: fresh 28-day Square authority, mapping,
    confirmed recipe revision, fresh physical count, supplier identity, and no
    current blocker. If a trustworthy MISE recommendation has not appeared,
    Inventory → item → Add to order is an acceptable manual bootstrap after the
    complete Square window. It does not count as purchase-memory evidence.

## First safe order test

1. Select one small MISE-generated recommendation when possible. Review the
   basis and current blockers.
2. Approve the suggested quantity or deliberately enter a bounded override.
3. Open the new supplier draft. Verify supplier ID/name snapshot and every line.
4. Verify From, TEST To, Subject, and the complete body. Save any note first and
   re-review the refreshed fingerprint.
5. In Supabase Edge secrets, set `GMAIL_SEND_ENABLED=true` for this controlled
   test only. Then enable the restaurant delivery gate:

   ```bash
   npm run pilot:controls -- \
     --restaurant-id <restaurant-uuid> \
     --action enable-gmail-delivery \
     --apply \
     --confirm-project-ref <staging-project-ref>
   ```

6. Tap Approve & send exactly once. Do not retry an in-progress or unknown result.
7. Confirm the test inbox received exactly one message with the reviewed bytes.
8. Confirm the order is durably `sent`, recommendations are `ordered`, and the
   provider message ID/delivery record exists.
9. Mark the physical delivery received in Order detail and confirm durable receipt evidence.
10. Confirm a MISE-generated decision appended one purchase-decision event. A
    manual recommendation is not a substitute for this proof.
11. Disable Gmail immediately after the test if live cutover is not happening:

    ```bash
    npm run pilot:controls -- \
      --restaurant-id <restaurant-uuid> \
      --action disable-gmail-delivery \
      --apply \
      --confirm-project-ref <staging-project-ref>
    ```

## Live supplier cutover

Only continue after the test message, durable sent state, and incident contacts
are verified.

1. Disable Gmail delivery.
2. Replace the TEST recipient in Settings → Suppliers with the operator-verified
   real supplier address. This invalidates prior reviewed content.
3. Open the next draft and re-verify supplier, recipient, sender, subject, body,
   quantities, and current purchase authority.
4. Re-enable Gmail for the restaurant, approve the new fingerprint, and send once.
5. Keep Square webhooks off for the first manual day. Enable them only after a
   successful manual full sync and webhook signature test.
6. At session end, record the scorecard in `PILOT_SCORECARD.md`.
