# MISE-005AK: supplier_orders provider_message_id cntrl locale pin

Date: 2026-09-27  
Branch: `cursor/mise-supplier-orders-provider-message-id-cntrl-locale-pin`  
Base: `origin/main` @ `78da737`

## Problem

`public.supplier_orders.provider_message_id` still accepted any non-null text
of length 1–512 with no control-character rejection inside the compound
`supplier_orders_email_delivery_check`. MISE-005AJ (#444) pins the private
`supplier_email_deliveries.provider_message_id` CHECK with COLLATE `"C"` cntrl
rejection; MISE-005T (#428) pins the complete-send RPC preflight the same way.
This public mirror remained length-only.

`provider_message_id` on `supplier_orders` is the durable Gmail provider id
mirrored after `users.messages.send` accepts the message. Under ctype drift,
dump/restore and private→public continuity can disagree on the same provider
bytes.

## Fix

Additive migration
`20260927080000_mise_005ak_supplier_orders_provider_message_id_cntrl_locale_pin.sql`
reattaches `supplier_orders_email_delivery_check` preserving the
`email_provider` and draft/sent coherence halves, and pinning the
`provider_message_id` half to:

```sql
provider_message_id is null
or (
  pg_catalog.length(provider_message_id) between 1 and 512
  and provider_message_id collate "C" !~ '[[:cntrl:]]'
)
```

## Out of scope

- Does not rewrite `private.service_complete_supplier_email_send` (open #428)
- Does not rewrite `private.supplier_email_deliveries.provider_message_id`
  CHECK (open #444)
- Does not rewrite claim / rfc / envelope metadata CHECKs

## Compose

Compose-safe alone on main. Does not rewrite any function or CHECK owned by
open #418–#444. Prefer after MISE-005AJ (#444) and MISE-005T (#428) so RPC +
private CHECK + public mirror pins land together; timestamp after MISE-005AJ
(#444).

## Verification

- `npm run typecheck`
- focused `tests/supplierOrdersProviderMessageIdCntrlLocalePin.test.ts`
- `npm test`
- pgTAP fixture committed; not executed here (no Docker)
