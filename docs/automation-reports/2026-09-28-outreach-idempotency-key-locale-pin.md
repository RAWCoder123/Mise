# MISE-005BK: outreach_messages.idempotency_key COLLATE C locale pin

Date: 2026-09-28
Branch: `cursor/mise-outreach-idempotency-key-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Add an ASCII shape CHECK under COLLATE `"C"` on:

- `public.outreach_messages.idempotency_key`

```sql
idempotency_key collate "C" ~ '^[A-Za-z0-9_]{1,64}$'
```

Covers the foundation default mint (`outreach_` + 32 hex digits, 41 bytes)
with headroom. Rejects spaces, hyphens, colons, control bytes, and non-ASCII.

## Why

`idempotency_key` is the durable Resend `Idempotency-Key` identity minted by
the column default and read by `outreach-agent` on send. The column had no
length or charset CHECK while sibling action/confirmation and outreach
provider-id pins already gate ASCII identity under COLLATE `"C"`. Without a
matching gate, dump/restore under a drifted `LC_CTYPE` could accept an
idempotency identity a restored C-locale path would refuse (or the reverse),
breaking Resend send dedupe continuity.

## Writer audit (ASCII-only)

| Path | Mint |
| --- | --- |
| Column default (`20260718010000_outreach_agent.sql`) | `'outreach_' \|\| replace(gen_random_uuid()::text, '-', '')` |
| `outreach-agent` | Reads stored key; sends as `Idempotency-Key` header (no rewrite) |

Authenticated / anon clients remain revoked for outreach table DML; only
service_role writes.

## Out of scope

- Rewriting `supabase/functions/outreach-agent/index.ts`
- `outreach_messages.provider_message_id` / `outreach_events.provider_message_id` (#470)
- `outreach_events.provider_event_id` (#469)
- `activity_events.idempotency_key` (ISO / free-form labels)
- `restaurant_memories.dedupe_key` (supplier-name legacy)
- `inventory_events` identity (#375)
- `mise_actions` / `action_outcomes` idempotency keys (#457)

## Verification

- `npm run typecheck`
- focused: `outreachIdempotencyKeyLocalePin`
- `npm test`
- `npm run supabase:test` blocked locally when Docker unavailable
