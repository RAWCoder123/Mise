# MISE-005BY: pin insights.generation_source CHECK to COLLATE C

Date: 2026-09-29
Branch: `cursor/mise-insights-generation-source-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Replace the bare-IN `insights_generation_source_check` on `public.insights`
with the exact-token allowlist plus ASCII shape under COLLATE `"C"`:

```sql
generation_source in ('manual', 'mise_rules', 'legacy_client')
and generation_source collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
```

## Writer vocabulary

Confirmed ASCII mint (same allowlist as purchase_recommendations):

- `manual` — operator / manual insight paths
- `mise_rules` — server-generated insight commit
- `legacy_client` — retained historical client-authored rows

Exact-token allowlist is preserved; this tip adds the COLLATE C ASCII shape
gate alongside it.

## Why

MISE-005A proved locale drift on this cluster. MISE-005BX (#484) pinned the
sibling `purchase_recommendations.generation_source` gate, but left
`insights.generation_source` on bare IN only. Without a dedicated COLLATE C
shape CHECK, dump/restore under LC_CTYPE drift can accept provenance bytes
the restored C-locale path would refuse — or the reverse — breaking insight
provenance continuity across restore.

## Scope

- CHECK-only on `insights_generation_source_check`
- Does **not** rewrite insight commit writers
- Does **not** touch `planning_revision`
- Does **not** touch `purchase_recommendations.generation_source` (#484 / MISE-005BX)
- Does **not** touch ai_insights provenance (#483)
- Alone on main OK; timestamp after #484 (`20260928231000`)

## Verification

- `npm run typecheck`
- focused `tests/insightsGenerationSourceLocalePin.test.ts`
- `npm test`
- pgTAP fixture committed; Docker/hosted pgTAP not run here

## Files

- `supabase/migrations/20260928231000_mise_005by_insights_generation_source_locale_pin.sql`
- `supabase/tests/database/insights_generation_source_locale_pin.test.sql`
- `tests/insightsGenerationSourceLocalePin.test.ts`
- `docs/automation-reports/2026-09-29-insights-generation-source-locale-pin.md`
