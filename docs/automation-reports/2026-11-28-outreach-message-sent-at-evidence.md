# Outreach message sent_at evidence INSERT tip (2026-11-28)

## Gap

`public.outreach_messages.sent_at` is nullable so draft / approved / sending /
failed / send_unknown rows can omit send time. Soft table constraints only
require `approved_at` when `status = 'approved'`. Hosted send transitions stamp
`sent_at` on UPDATE, but direct / service_role inserts can still mint `sent`
or `delivered` messages with null `sent_at`. Authenticated client DML is
already revoked; service_role retains INSERT.

## Change

- Domain: `validateOutreachMessageSentAtEvidence` → `missing_sent_at`
- Additive BEFORE INSERT tip only (no NOT NULL / status-implies-timestamp CHECK)
- pgTAP plan = 9 (derived from assertion call sites)

## Alone-OK

Orthogonal to tip stacks #1263–#1327 and mise_actions failure evidence (#1305).
Sibling of outreach message failure evidence (#1326) and supplier-order
sent_at evidence (#1319). Draft writers INSERT without `sent_at`; send paths
stamp evidence on UPDATE. Contested merge: none expected — no fixture INSERTs
a successful `sent` / `delivered` row without `sent_at`.

## Verification

- `npm run typecheck`
- focused outreach-message sent_at suite
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- Docker `npm run supabase:test` when available
