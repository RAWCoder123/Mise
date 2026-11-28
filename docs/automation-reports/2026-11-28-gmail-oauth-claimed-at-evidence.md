# Gmail OAuth claimed_at evidence (2026-11-28)

## Gap

`private.gmail_oauth_flows.claimed_at` is nullable for open flows and
pre-claim failures. Soft constraints only forbid `completed_at` and
`failed_at` together. Direct / SECURITY DEFINER inserts can mint
`completed_at` with null `claimed_at`. Hosted complete requires an
already-claimed flow on UPDATE; hosted fail may fail unclaimed flows.
Authenticated client and service_role DML are revoked; begin writers INSERT
open flows then claim / complete on UPDATE.

## Change

- Domain: `validateGmailOauthClaimedAtEvidence` → `missing_claimed_at`
- Additive BEFORE INSERT tip only (no NOT NULL / completed-implies-claimed CHECK)
- pgTAP plan = 9 (derived from assertion call sites)

## Alone-OK

Orthogonal to tip stacks #1263–#1329, including sibling Gmail OAuth failure
evidence (#1325). Soft contested merge with #1325's completed-without-failure
fixture (must stamp `claimed_at` when both land). Begin writer unaffected.
Fail-without-claim inserts remain allowed.

## Verification

- `npm run typecheck` — passed
- focused claimed_at suite — 4/4 passed
- `npm test` — 687 / 680 pass / 0 fail / 7 cancelled
- `npm run security:static` — passed
- `npm run security:backend` — passed
- `npm run design:static` — passed
- Docker unavailable for `npm run supabase:test`
