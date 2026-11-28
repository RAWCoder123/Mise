# Outreach agent run completed_at evidence INSERT tip (2026-11-28)

## Gap

`public.outreach_agent_runs.completed_at` is nullable so running rows can omit
completion time. Soft table constraints do not require `completed_at` when
`status` is `completed` or `failed`. Hosted completion and failure transitions
stamp `completed_at` on UPDATE, but direct / service_role inserts can still
mint untimed terminal runs. Authenticated client DML is already revoked;
service_role retains INSERT.

## Change

- Domain: `validateOutreachAgentRunCompletedAtEvidence` → `missing_completed_at`
- Additive BEFORE INSERT tip only (no NOT NULL / status-implies-timestamp CHECK)
- pgTAP plan = 9 (derived from assertion call sites)

## Alone-OK

Orthogonal to tip stacks #1263–#1328, including the sibling
outreach_agent_runs failure-evidence tip (#1327) and mise_actions executed_at
evidence (#1304). Sibling of supplier-order sent_at (#1319) and
outreach-message sent_at (#1328). The agent writer INSERTs `status = 'running'`
without `completed_at`. Contested merge: none expected — no fixture INSERTs a
successful completed/failed run without `completed_at`.

## Verification

- `npm run typecheck`
- focused outreach-agent-run completed_at suite 4/4
- `npm test` 687 / 680 pass / 0 fail / 7 cancelled
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- Docker unavailable for `npm run supabase:test`
