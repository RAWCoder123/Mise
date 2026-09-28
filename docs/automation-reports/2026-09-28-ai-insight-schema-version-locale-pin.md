# MISE-005BS: pin ai_insights.schema_version CHECK to COLLATE C

Date: 2026-09-28
Branch: `cursor/mise-ai-insight-schema-version-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Replace length-only CHECK on `public.ai_insights.schema_version`:

- was: `pg_catalog.length(schema_version) between 1 and 80`
  (`ai_insights_schema_version_length_check`)
- now: `schema_version collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'`
  (`ai_insights_schema_version_check`)

## Writer vocabulary

Confirmed ASCII mint:

- `mise.ai_insight.v1` from:
  - `private.service_create_rules_engine_ai_insight`
  - `services/ai/structuredInsights.ts`
  - `supabase/functions/_shared/mise.ts`
  - table default on `public.ai_insights`

Dots are required (unlike inventory_events identity), so the charset matches
recalculation `job_name` (#453): `A-Za-z0-9._-`.

## Scope

- CHECK-only; does **not** rewrite `service_create_rules_engine_ai_insight`
- Does **not** touch `source` / `generated_by` provenance, output bounds,
  `inventory_events` identity (#478), `activity_events`, or
  `restaurant_memories`
- Alone on main OK; timestamp after #478 (`20260928180000`)

## Verification

- `npm run typecheck`
- focused `tests/aiInsightSchemaVersionLocalePin.test.ts`
- `npm test`
- pgTAP fixture committed; Docker/hosted pgTAP not run here

## Files

- `supabase/migrations/20260928180000_mise_005bs_ai_insight_schema_version_locale_pin.sql`
- `supabase/tests/database/ai_insight_schema_version_locale_pin.test.sql`
- `tests/aiInsightSchemaVersionLocalePin.test.ts`
- `docs/automation-reports/2026-09-28-ai-insight-schema-version-locale-pin.md`
