# MISE-005BJ: outreach provider_message_id COLLATE C locale pin

Date: 2026-09-28
Branch: `cursor/mise-outreach-provider-message-id-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Add nullable length + cntrl CHECKs under COLLATE `"C"` on:

- `public.outreach_messages.provider_message_id`
- `public.outreach_events.provider_message_id`

```text
null allowed
or (length between 1 and 512 and collate "C" !~ '[[:cntrl:]]')
```

Empty values remain rejected. Non-null values match the length + cntrl
contract used for sibling provider_message_id pins (#444/#445).

## Why

`provider_message_id` is the durable Resend email id written by
`outreach-agent` after a successful send and copied onto `outreach_events` by
`outreach-webhook` for message↔event join. Both columns had no length or
charset CHECK while sibling provider-identity pins already reject ASCII
controls under COLLATE `"C"`. Without a matching gate, dump/restore under a
drifted `LC_CTYPE` could accept a Resend identity a restored C-locale path
would refuse (or the reverse), breaking webhook delivery continuity.

## Out of scope

- Rewriting `supabase/functions/outreach-agent/index.ts`
- Rewriting `supabase/functions/outreach-webhook/index.ts`
- `outreach_messages.idempotency_key`
- `outreach_events.provider_event_id` (#469)
- `outreach_events.event_type`
- `supplier_email_deliveries` / `supplier_orders` provider_message_id (#444/#445)
- activity_events / restaurant_memories / inventory_events

## Verification

- `npm run typecheck` — pass
- focused: `outreachProviderMessageIdLocalePin` — 5/5
- `npm test` — 681 pass / 0 fail / 7 cancelled (withTimeout baseline)
- `npm run supabase:test` blocked locally when Docker unavailable
