# MISE-005E — jsonb CHECK bounds via octet_length

Date: 2026-09-25  
Branch: `cursor/mise-jsonb-bound-octet-length`  
Base: `origin/main` @ `78da737`

## Problem

Several operational tables still bounded jsonb payloads with `pg_column_size` inside CHECK constraints:

- `operational_issues`, `mise_actions`, `action_outcomes`, `restaurant_memories`
- `activity_events`, `supplier_order_confirmations`
- `restaurant_tasks`
- `purchase_decision_events.context_evidence`

`pg_column_size` reports on-disk size and can change with TOAST compression or storage settings. PostgreSQL assumes CHECK expressions are retrospectively immutable, so a dump/restore can reject rows the source accepted. MISE-005A called this out as a remaining site after the purchase-line locale pin.

Later Mise work already preferred `octet_length(value::text)` (MISE-003A authority jsonb, pilot control evidence).

## Change

Additive migration `20260925231000_mise_005e_jsonb_bound_octet_length.sql`:

- Drop each named (or inline) `pg_column_size` CHECK.
- Re-add the same named constraint using `pg_catalog.octet_length(...::text)` at the same byte ceiling.
- Leave `record_supplier_delivery`'s function-body `pg_column_size(p_lines)` alone so open receive stacks are not rewritten.

## Verification

- Source-pin + catalog fixture tests in `tests/jsonbBoundOctetLength.test.ts`
- `purchaseDecisionMemoryBoundary.test.ts` updated to require the live 005E pin
- Committed pgTAP: `supabase/tests/database/jsonb_bound_octet_length.test.sql`
- `npm run typecheck` / focused + full `npm test` (see PR)

## Out of scope

- Landing/rebasing open stacks #348–#412
- `realtime.to_regrole` audit (still deferred)
- Inventing MOQ / lead_time / expiration
- Rewriting contested supplier-delivery function bodies
