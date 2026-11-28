# Sales import failure evidence INSERT tip (2026-11-28)

## Gap

`sales_imports.error_message` is nullable so queued / processing / completed
rows can omit failure text. Soft table constraints do not require
`error_message` when `status = 'failed'`. Hosted
`service_record_square_sync_failure` stamps a bounded reason, but direct /
`service_role` inserts can still mint failed imports with null or blank
`error_message`. Client DML is already revoked.

## Change

- Domain: `validateSalesImportFailureEvidence` → `missing_error_message`
- Additive BEFORE INSERT tip only (no NOT NULL / status-implies-error CHECK)
- pgTAP plan = 8 (derived from assertion call sites)

## Alone-OK

Orthogonal to tip stacks #1263–#1321 and mise_actions failure evidence (#1305).
Existing fixtures INSERT completed / processing / queued rows without
`error_message`. Contested merge: none expected — no fixture INSERTs a
successful `failed` row without failure text.

## Verification

- `npm run typecheck`
- focused sales-import failure suite
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- Docker `npm run supabase:test` when available
