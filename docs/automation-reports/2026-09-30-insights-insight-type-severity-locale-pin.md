# MISE-005DC: pin insights.insight_type and severity CHECKs to COLLATE C

Date: 2026-09-30
Branch: `cursor/mise-insights-insight-type-severity-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Replace the bare-IN `insights.insight_type` and `insights.severity`
allowlists with the exact-token contracts plus ASCII shape under COLLATE
`"C"`:

```sql
insight_type in ('sales', 'inventory', 'waste', 'cost', 'prep', 'ordering')
and insight_type collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'

severity in ('info', 'warning', 'urgent')
and severity collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
```

## Writer vocabulary

Confirmed ASCII mint (`service_commit_*` insight writers, domain signal
builders, and table CHECKs from secure_multi_tenant_rls):

insight_type:

- `sales` — sales-mix / demand guidance
- `inventory` — stock health and stockout risk
- `waste` — spoilage and waste risk
- `cost` — food-cost / spend guidance
- `prep` — prep and service readiness
- `ordering` — purchasing and reorder guidance

severity:

- `info` — informational / low urgency
- `warning` — needs attention soon
- `urgent` — needs attention now

Exact-token allowlists are preserved; this tip adds the COLLATE C ASCII
shape gate alongside them.

## Why

MISE-005A proved locale drift on this cluster. Open sibling pin #485 covers
`insights.generation_source`, and #508 covers `operational_issues.severity`,
but leave `insights.insight_type` and `insights.severity` on bare IN only.
Without dedicated COLLATE C shape CHECKs, dump/restore under LC_CTYPE drift
can accept insight-vocabulary bytes the restored C-locale path would refuse
— or the reverse — breaking insight continuity across restore.

## Scope

- CHECK-only on `public.insights.insight_type` and `public.insights.severity`
- Does **not** rewrite insight commit writers
- Does **not** touch `insights.generation_source` (#485)
- Does **not** touch `planning_revision`
- Does **not** touch `ai_insights` provenance (#483)
- Does **not** touch `operational_issues.severity` (#508)
- Does **not** touch free-form insight body text (`title`, `description`,
  `recommended_action`, `why_it_matters`)
- Alone on main OK; timestamp after #514 (`20260930160000`)

## Verification

- `npm run typecheck` pass
- focused `tests/insightsInsightTypeSeverityLocalePin.test.ts` 3/3 pass
- `npm test` 679 pass / 0 fail / 7 cancelled (withTimeout baseline; includes
  the three new MISE-005DC static checks)
- pgTAP fixture committed (plan 20 from 20 assertion call sites); Docker/hosted
  pgTAP not run here

## Files

- `supabase/migrations/20260930170000_mise_005dc_insights_insight_type_severity_locale_pin.sql`
- `supabase/tests/database/insights_insight_type_severity_locale_pin.test.sql`
- `tests/insightsInsightTypeSeverityLocalePin.test.ts`
- `docs/automation-reports/2026-09-30-insights-insight-type-severity-locale-pin.md`
