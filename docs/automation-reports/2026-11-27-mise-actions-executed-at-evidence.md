# Mise-action executed_at INSERT evidence (2026-11-27)

## Gap

`mise_actions.executed_at` is nullable because non-executed statuses and
failure UPDATEs legitimately leave it null. Hosted writers that advance an
action to `executed` stamp `executed_at`, and the foundation backfill stamps
it when inserting already-sent supplier orders as `executed`, but direct
inserts can still mint an `executed` action with `executed_at = null` — a
completed-action claim Activity / audit analysis cannot place in time.

## Change

- Domain: `validateMiseActionsExecutedAtEvidence` → `missing_executed_at`
- Additive BEFORE INSERT tip only on `public.mise_actions`
- No NOT NULL / status-implies-timestamp CHECK (preserves non-executed rows
  and failure UPDATEs that leave `executed_at` null)
- Does not rewrite `decide_mise_action` or supplier-send writers
- pgTAP plan = 7 (derived from assertion call sites)

## Alone-OK

Orthogonal to mise_actions decision-actor tip (#1298), locale / ASCII-C pins,
and inventory / count-session / purchase-line / autonomy / audit / activity
actor tips. Does not invent unconditional table-level NOT NULL. Does not
require `executed_at` on `failed` / `unverified` / pre-execution inserts.

## Verification

- `npm run typecheck`
- focused `miseActionsExecutedAtEvidence` suite
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- Docker `npm run supabase:test` when available
