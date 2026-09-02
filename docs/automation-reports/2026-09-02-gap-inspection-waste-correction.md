# Gap inspection 2026-09-02 (main @ 20b28e5, post #344 themes)

Read-only product-gap inspection. Tip `cursor/mise-product-inspection-3e89` @ `20b28e5` (= `origin/main`). Open drafts ~#147–#344. Batch `daily-operating-plan-41` complete.

## Method

1. Listed open PR titles via `gh pr list --state open --limit 300`.
2. Cross-checked public tables/RPCs on main vs `app/` + `services/` usage.
3. Cross-checked automation memories (through post–modifier-depletion tip).
4. Spot-read ledger, waste analysis, validation, and Waste UI on main.

## Covered / do not duplicate

Open stacks through #344 especially: transfers (#215), pack_quantity (#291), receive substitution (#293), #332–#344 yield/catalog/automation/confirmation/substitutions/modifiers/routines/depletion, Ask Mise grounding, Home pulse fail-closed, soft-refresh, search uncapping, staff waste (#214), waste reasons (#301), waste CTAs (#308).

## Top recommendation

**Allow managers to correct mistaken waste via ledger `correction` events**

See structured recommendation in the agent final response. Summary: schema + RPC + domain projection/analysis already honor `event_type=correction` with `supersedes_event_id`; operator validation and UI intentionally block it. No open PR owns waste correction/undo.

## Runners-up

1. Browse durable `operational_issues` (SELECT + trigger writes exist; demo export always `[]`; no client read).
2. Surface append-only `action_outcomes` from supplier receives on Orders/Insights (written by `record_supplier_delivery`; Memory already absorbs lessons).

## Skip / blocked

Inventing MOQ/lead_time/expiration; land/rebase of open stacks as the only “product” work; consuming substitutions/yields/modifiers in depletion until #293/#337/#338/#340/#341/#344 merge; contested Home/Ask/soft-refresh polish.
