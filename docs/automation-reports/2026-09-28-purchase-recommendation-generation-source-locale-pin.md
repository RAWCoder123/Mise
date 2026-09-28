# MISE-005BX: pin purchase_recommendations.generation_source CHECK to COLLATE C

Date: 2026-09-28
Branch: `cursor/mise-purchase-recommendation-generation-source-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Replace the bare-IN `purchase_recommendations_generation_source_check` on
`public.purchase_recommendations` with the exact-token allowlist plus ASCII
shape under COLLATE `"C"`:

```sql
generation_source in ('manual', 'mise_rules', 'legacy_client')
and generation_source collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
```

## Writer vocabulary

Confirmed ASCII mint:

- `manual` — operator / manual recommendation paths
- `mise_rules` — server-generated recommendation commit
- `legacy_client` — retained historical client-authored rows

Exact-token allowlist is preserved; this tip adds the COLLATE C ASCII shape
gate alongside it.

## Why

MISE-005A proved locale drift on this cluster. Later 005* tips pinned sibling
machine-identity gates (including ai_insights provenance #483 and
purchase_decision evidence_version #482) but left
`purchase_recommendations.generation_source` on bare IN only. Without a
dedicated COLLATE C shape CHECK, dump/restore under LC_CTYPE drift can accept
provenance bytes the restored C-locale path would refuse — or the reverse —
breaking purchase-recommendation provenance continuity across restore.

## Scope

- CHECK-only on `purchase_recommendations_generation_source_check`
- Does **not** rewrite purchase approval / decision writers
- Does **not** touch `planning_revision`
- Does **not** touch `insights.generation_source` (sibling bare IN; separate tip)
- Does **not** touch ai_insights provenance (#483)
- Alone on main OK; timestamp after #483 (`20260928230000`)

## Verification

- `npm run typecheck`
- focused `tests/purchaseRecommendationGenerationSourceLocalePin.test.ts`
- `npm test`
- pgTAP fixture committed; Docker/hosted pgTAP not run here

## Files

- `supabase/migrations/20260928230000_mise_005bx_purchase_recommendation_generation_source_locale_pin.sql`
- `supabase/tests/database/purchase_recommendation_generation_source_locale_pin.test.sql`
- `tests/purchaseRecommendationGenerationSourceLocalePin.test.ts`
- `docs/automation-reports/2026-09-28-purchase-recommendation-generation-source-locale-pin.md`
