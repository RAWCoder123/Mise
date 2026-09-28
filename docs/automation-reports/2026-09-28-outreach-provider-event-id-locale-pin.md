# MISE-005BI: outreach_events.provider_event_id COLLATE C locale pin

Date: 2026-09-28
Branch: `cursor/mise-outreach-provider-event-id-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Add a length + cntrl CHECK under COLLATE `"C"` on
`public.outreach_events.provider_event_id`:

```text
length between 1 and 255
and collate "C" !~ '[[:cntrl:]]'
```

Empty values remain rejected (column is NOT NULL UNIQUE). Non-empty values
match the length + cntrl contract used for sibling provider ids (Gmail
provider_subject, Square merchant_id, supplier email provider_message_id).

## Why

`provider_event_id` is the durable Svix webhook idempotency key written by
`outreach-webhook` after signature verification. The column had no length or
charset CHECK while sibling provider-identity pins already reject ASCII
controls under COLLATE `"C"`. Without a matching gate, dump/restore under a
drifted `LC_CTYPE` could accept a webhook identity a restored C-locale path
would refuse (or the reverse), breaking Svix replay continuity.

## Out of scope

- Rewriting `supabase/functions/outreach-webhook/index.ts`
- `outreach_messages.provider_message_id` / `idempotency_key`
- `outreach_events.provider_message_id` / `event_type`
- `supplier_email_deliveries.provider_message_id` (#444)
- activity_events / restaurant_memories / inventory_events

## Verification

- `npm run typecheck` — pass
- focused: `outreachProviderEventIdLocalePin` — 5/5
- `npm test` — 681 pass / 0 fail / 7 cancelled (withTimeout baseline)
- `npm run supabase:test` blocked locally when Docker unavailable
