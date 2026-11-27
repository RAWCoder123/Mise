# Mise-action rollback evidence INSERT tip (2026-11-27)

## Gap

`mise_actions.rollback_reference` is nullable because non-reversed statuses
legitimately leave it null. Domain `markReversed` already requires a non-empty
rollback reference when advancing an action to `reversed`, but direct inserts
can still mint a terminal reversal claim with `rollback_reference` null — a
reversal Activity / audit analysis cannot explain.

## Change

- Domain: `validateMiseActionsRollbackEvidence` → `missing_rollback_reference`
- Additive BEFORE INSERT tip only on `public.mise_actions`
- No NOT NULL / status-implies-reference CHECK (preserves non-reversed rows)
- Does not rewrite `decide_mise_action` or `service_record_mise_action_failure`
- pgTAP plan = 7 (derived from assertion call sites)

## Alone-OK

Orthogonal to mise_actions executed_at tip (#1304), failure-evidence tip
(#1305), decision-actor tip (#1298), locale / ASCII-C pins (including
rollback_reference cntrl / ASCII-C pins), and inventory / count-session /
purchase-line / autonomy / audit / activity actor tips. Does not invent
unconditional table-level NOT NULL. Does not require rollback evidence on
pre-reversal or `executed` inserts.

## Verification

- `npm run typecheck`
- focused `miseActionsRollbackEvidence` suite
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- Docker `npm run supabase:test` when available
