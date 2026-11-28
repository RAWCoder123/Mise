# Outreach message failure evidence INSERT tip (2026-11-28)

## Gap

`public.outreach_messages.last_error` is nullable so draft / approved /
sending / sent / delivered rows can omit failure text. Soft table constraints
only require `approved_at` when `status = 'approved'`. Hosted fail and
`send_unknown` transitions stamp a bounded reason, but direct / service_role
inserts can still mint `failed` or `send_unknown` messages with null or blank
`last_error`. Authenticated client DML is already revoked; service_role retains
INSERT.

## Change

- Domain: `validateOutreachMessageFailureEvidence` → `missing_last_error`
- Additive BEFORE INSERT tip only (no NOT NULL / status-implies-error CHECK)
- pgTAP plan = 9 (derived from assertion call sites)

## Alone-OK

Orthogonal to tip stacks #1263–#1325 and mise_actions failure evidence (#1305).
Sibling of supplier-email delivery failure evidence (#1323). Draft writers
INSERT without `last_error`; failure paths stamp evidence on UPDATE. Contested
merge: none expected — no fixture INSERTs a successful `failed` /
`send_unknown` row without failure text.

## Verification

- `npm run typecheck`
- focused outreach-message failure suite
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- Docker `npm run supabase:test` when available
