# MISE-005AJ: provider_message_id cntrl locale pin

Date: 2026-09-27  
Branch: `cursor/mise-provider-message-id-cntrl-locale-pin`  
Base: `origin/main` @ `78da737`

## Problem

`private.supplier_email_deliveries.provider_message_id` still accepted any
non-null text of length 1–512 with no control-character rejection. MISE-005T
(#428) pins the complete-send RPC preflight to
`p_provider_message_id collate "C" ~ '[[:cntrl:]]'` but intentionally does not
reattach this table CHECK. MISE-005J pinned the sibling `rfc_message_id` CHECK
with COLLATE `"C"` cntrl rejection; `provider_message_id` remained length-only.

`provider_message_id` is the durable Gmail provider id persisted after
`users.messages.send` accepts the message. Under ctype drift, dump/restore and
claim→complete continuity can disagree on the same provider bytes.

## Fix

Additive migration
`20260927070000_mise_005aj_provider_message_id_cntrl_locale_pin.sql`
reattaches `supplier_email_deliveries_provider_message_id_check`:

```sql
provider_message_id is null
or (
  pg_catalog.length(provider_message_id) between 1 and 512
  and provider_message_id collate "C" !~ '[[:cntrl:]]'
)
```

## Out of scope

- Does not rewrite `private.service_complete_supplier_email_send` (open #428)
- Does not rewrite claim / rfc / envelope metadata CHECKs
- Does not rewrite `public.supplier_orders_email_delivery_check` (compound
  length-only sibling; deferred)

## Compose

Compose-safe alone on main. Does not rewrite any function or CHECK owned by
open #418–#443. Prefer after MISE-005T (#428) so RPC + CHECK pins land
together; timestamp after MISE-005AI (#443).

## Verification

- `npm run typecheck`
- focused `tests/providerMessageIdCntrlLocalePin.test.ts`
- `npm test`
- pgTAP fixture committed; not executed here (no Docker)
