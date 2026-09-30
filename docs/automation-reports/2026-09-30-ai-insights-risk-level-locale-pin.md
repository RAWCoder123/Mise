# MISE-005DI: pin ai_insights.risk_level CHECK to COLLATE C

Date: 2026-09-30
Branch: `cursor/mise-ai-insights-risk-level-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Replace the bare-IN `ai_insights.risk_level` allowlist (`low` / `medium` /
`high`) with the exact-token contract plus ASCII shape under
COLLATE `"C"`:

```sql
risk_level in ('low', 'medium', 'high')
and risk_level collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
```

## Writer vocabulary

Confirmed ASCII mint (`types/mise.ts` `AiInsightRiskLevel`, restaurant-ops
backbone create-table allowlist, structured insight Zod enum, and
`private.service_create_rules_engine_ai_insight` reading
`p_output ->> 'risk_level'`):

- `low` — low operational risk
- `medium` — elevated risk requiring attention
- `high` — high risk requiring prompt action

Exact-token allowlist is preserved; this tip adds the COLLATE C ASCII shape
gate alongside it.

## Why

MISE-005A proved locale drift on this cluster. Open sibling pins #520
(status), #483 (provenance), and #479 (schema_version) leave
`ai_insights.risk_level` on bare IN only. Without a dedicated COLLATE C
shape CHECK, dump/restore under LC_CTYPE drift can accept insight severity
bytes the restored C-locale path would refuse — or the reverse — breaking
AI insight continuity across restore.

## Scope

- CHECK-only on `public.ai_insights.risk_level`
- Does **not** rewrite `private.service_create_rules_engine_ai_insight`
- Does **not** touch status (#520), provenance (#483), or schema_version (#479)
- Alone on main OK; timestamp after #520 (`20260930230000`)

## Verification

- `npm run typecheck` pass
- focused `tests/aiInsightsRiskLevelLocalePin.test.ts` 3/3 pass
- `npm test` 679 pass / 0 fail / 7 cancelled (inherited cancelledByParent noise; new
  MISE-005DI cases pass)
- pgTAP fixture committed (plan 11 from 11 assertion call sites); Docker/hosted
  pgTAP not run here

## Files

- `supabase/migrations/20260930230000_mise_005di_ai_insights_risk_level_locale_pin.sql`
- `supabase/tests/database/ai_insights_risk_level_locale_pin.test.sql`
- `tests/aiInsightsRiskLevelLocalePin.test.ts`
- `docs/automation-reports/2026-09-30-ai-insights-risk-level-locale-pin.md`
