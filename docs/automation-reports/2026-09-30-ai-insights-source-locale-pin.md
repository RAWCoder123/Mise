# MISE-005DJ: pin ai_insights.source CHECK to COLLATE C

Date: 2026-09-30
Branch: `cursor/mise-ai-insights-source-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Replace the bare-IN `ai_insights.source` allowlist
(`openai_structured_output` / `rules_engine` / `operator_note`) with the
exact-token contract plus ASCII shape under COLLATE `"C"`:

```sql
source in ('openai_structured_output', 'rules_engine', 'operator_note')
and source collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
```

## Writer vocabulary

Confirmed ASCII mint (`types/mise.ts` AiInsight `source` union,
restaurant-ops backbone create-table allowlist, and
`services/ai/structuredInsights.ts`):

- `openai_structured_output` — structured LLM insight path
- `rules_engine` — deterministic rules-engine path
- `operator_note` — operator-authored insight note

Exact-token allowlist is preserved; this tip adds the COLLATE C ASCII shape
gate alongside it.

## Why

MISE-005A proved locale drift on this cluster. Open sibling pins #521
(risk_level), #520 (status), #483 (provenance), and #479 (schema_version)
leave `ai_insights.source` on bare IN only. Provenance (#483) pins a
server-side composition involving `source = rules_engine`; it does not
replace this column-level allowlist. Without a dedicated COLLATE C shape
CHECK, dump/restore under LC_CTYPE drift can accept insight source bytes
the restored C-locale path would refuse — or the reverse — breaking AI
insight continuity across restore.

## Scope

- CHECK-only on `public.ai_insights.source`
- Does **not** rewrite `private.service_create_rules_engine_ai_insight`
- Does **not** touch risk_level (#521), status (#520), provenance (#483), or
  schema_version (#479)
- Alone on main OK; timestamp after #521 (`20260930240000`)

## Verification

- `npm run typecheck` pass
- focused `tests/aiInsightsSourceLocalePin.test.ts` 3/3 pass
- `npm test` 679 pass / 0 fail / 7 cancelled (inherited cancelledByParent noise; new
  MISE-005DJ cases pass)
- pgTAP fixture committed (plan 11 from 11 assertion call sites); Docker/hosted
  pgTAP not run here

## Files

- `supabase/migrations/20260930240000_mise_005dj_ai_insights_source_locale_pin.sql`
- `supabase/tests/database/ai_insights_source_locale_pin.test.sql`
- `tests/aiInsightsSourceLocalePin.test.ts`
- `docs/automation-reports/2026-09-30-ai-insights-source-locale-pin.md`
