# First restaurant onboarding runbook

## Before the meeting

- Provision the invite-only restaurant workspace through the existing admin workflow.
- Confirm the owner can sign in and has an active owner membership.
- Confirm restaurant name, timezone, currency, service style, and operating profile.
- Identify whether the session is staging or production. Do not mix provider credentials across environments.
- Keep Square sync, Square webhooks, Gmail delivery, and order automation disabled until their controlled step.

## Square

1. Use Square Sandbox for the first proof.
2. Connect Square from Settings → POS as the owner/admin.
3. Confirm OAuth returns to Mise and the connection shows the authorized merchant/location state.
4. Confirm the intended Square locations; stop if multiple locations cannot be distinguished safely.
5. Run a bounded initial sync.
6. Verify authoritative `pos_sales`, `sales_imports`, catalog mappings, last-sync state, and activity before trusting the UI banner.
7. Replay the same window and then an overlapping window. Confirm logical sales totals do not increase for the overlap.
8. Read the operating-loop readiness status in Settings → POS; treat every listed area as blocking evidence, not a cosmetic warning.

## Inventory

1. Create/import real inventory items without raw sensitive attachments.
2. Set and manager-verify canonical units and pack conversions.
3. Map suppliers and add positive unit costs only where known.
4. Begin the opening count; staff may count and submit.
5. Have a manager review variances and approve the session.
6. Verify append-only count events and projected on-hand state.

## Recipes and menu mapping

1. Start with the highest-volume Square items.
2. Resolve provider item/variation identity to the intended Mise menu item.
3. Add ingredient quantity-per-sale mappings using compatible verified units.
4. Leave uncertain or partial mappings blocked; never guess.
5. Verify mapped sales produce the expected ingredient usage and that unmapped sales reduce readiness.

## Suppliers

1. Confirm each inventory item’s supplier identity.
2. Save the operator-provided recipient email for the supplier.
3. Confirm the exact sender, recipient, supplier, quantities, units, and any incomplete costs on the review screen.

## Gmail

1. Use a Mise-controlled test Gmail sender and Mise-controlled test recipient.
2. Connect Gmail as an owner/admin and verify the sender identity.
3. Keep `GMAIL_SEND_ENABLED` and restaurant delivery controls off until the draft is reviewed.
4. Never use an actual supplier destination without explicit authorization.

## First operational day

1. Sync bounded Square sales and verify the processed record count.
2. Complete/approve the opening inventory count.
3. Review missing mapping and stale-data blockers.
4. Recompute planning.
5. Review Home, Today, Inventory, Orders, and activity for the same authoritative story.
6. Approve, adjust, or dismiss one recommendation.
7. Review the supplier-specific draft and destination.

## First controlled supplier test

1. Enable Gmail only for the authorized environment and restaurant.
2. Reconfirm sender and test destination.
3. Review the displayed From, To, and Subject, then use Approve recipient & send once. If any field changes, stop and approve the refreshed envelope again.
4. Do not retry an in-progress or ambiguous result.
5. Verify provider message acceptance, sent order state, ordered recommendations, activity, and audit metadata.
6. Record delivery/receipt and any discrepancy.

## After the proof

- Review the activity sequence and all operator-visible warnings.
- Compare projected consumption, ordered quantity, and received quantity.
- Record discrepancies and operator feedback using `PILOT_FEEDBACK_TEMPLATE.md`.
- Disable live provider controls until the next authorized test.
- Store redacted evidence only; never commit tokens, authorization headers, raw provider payloads, or full Gmail bodies.
