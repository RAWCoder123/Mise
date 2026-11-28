# Gmail OAuth failure evidence INSERT tip (2026-11-28)

## Gap

`private.gmail_oauth_flows.failure_code` is nullable so open and completed
flows can omit failure text. Soft table constraints only forbid completed and
failed together; they do not require `failure_code` when `failed_at` is set.
Hosted `service_fail_gmail_oauth` stamps a bounded slug on UPDATE, but direct
/ SECURITY DEFINER inserts can still mint unexplained terminal failures.
Client and service_role DML are already revoked.

## Change

- Domain: `validateGmailOauthFailureEvidence` → `missing_failure_code`
- Additive BEFORE INSERT tip only (no NOT NULL / failed_at-implies-code CHECK)
- pgTAP plan = 9 (derived from assertion call sites)

## Alone-OK

Orthogonal to tip stacks #1263–#1324 and mise_actions failure evidence (#1305).
Sibling of Square OAuth failure evidence (#1324). Existing begin writers INSERT
open flows without `failed_at`. Contested merge: none expected — no fixture
INSERTs a successful failed flow without `failure_code`.

## Verification

- `npm run typecheck`
- focused gmail-oauth failure suite
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- Docker `npm run supabase:test` when available
