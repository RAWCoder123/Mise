# Setup-attachment created_by INSERT evidence (2026-11-27)

## Gap

`setup_attachments.created_by` is nullable so account-deletion
anonymization can clear only the deleted operator's auth identity
(`ON DELETE SET NULL`). Hosted `public.save_restaurant_setup` already
stamps `auth.uid()` into `created_by` on INSERT, but direct inserts
(including service_role) can still mint unattributable setup attachments
with `created_by = null`. Client DML is revoked; service_role / direct
INSERT paths still reach the table. Fixtures always stamp a real
`created_by`.

## Change

- Domain: `validateSetupAttachmentCreatedByEvidence` → `missing_created_by`
- Additive BEFORE INSERT tip only on `public.setup_attachments`
- No NOT NULL / tighter CHECK (preserves anonymization UPDATEs)
- Does not rewrite `save_restaurant_setup`
- pgTAP plan = 8 (derived from assertion call sites)

## Alone-OK

Orthogonal to setup_attachments locale / ASCII-C / kind-status pins,
autonomy-rule created_by tip (#1303), audit-log / activity / inventory
actor tips, and tip stacks #1263–#1315. Does not invent unconditional
table-level NOT NULL.

## Verification

- `npm run typecheck`
- focused `setupAttachmentCreatedByEvidence` suite
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- Docker `npm run supabase:test` when available
