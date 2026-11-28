# Outreach agent run failure evidence INSERT tip (2026-11-28)

## Gap

`public.outreach_agent_runs.error_summary` is nullable so running and completed
runs can omit failure text. Soft table constraints do not require
`error_summary` when `status = 'failed'`. Hosted failure transitions stamp a
bounded reason on UPDATE, but direct / service_role inserts can still mint
unexplained terminal failures. Authenticated client DML is already revoked;
service_role retains INSERT.

## Change

- Domain: `validateOutreachAgentRunFailureEvidence` → `missing_error_summary`
- Additive BEFORE INSERT tip only (no NOT NULL / status-implies-error CHECK)
- pgTAP plan = 8 (derived from assertion call sites)

## Alone-OK

Orthogonal to tip stacks #1263–#1326, the error_summary cntrl locale pin, and
mise_actions failure evidence (#1305). Sibling of outreach message failure
evidence (#1326). The agent writer INSERTs `status = 'running'` without
`error_summary`. Contested merge: none expected — no fixture INSERTs a
successful failed run without `error_summary`.

## Verification

- `npm run typecheck`
- focused outreach-agent-run failure suite 4/4
- `npm test` 687 / 680 pass / 0 fail / 7 cancelled
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- Docker unavailable for `npm run supabase:test`
