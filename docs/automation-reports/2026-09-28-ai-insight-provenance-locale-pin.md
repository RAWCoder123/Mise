# MISE-005BW: pin ai_insights provenance CHECK to COLLATE C

Date: 2026-09-28
Branch: `cursor/mise-ai-insight-provenance-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Replace the bare-equality / IN `ai_insights_server_provenance_check` on
`public.ai_insights` with exact-token allowlists plus ASCII shape under
COLLATE `"C"`:

```sql
source = 'rules_engine'
and source collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
and generated_by in (
  'edge_function_scaffold',
  'mise_rules',
  'staging_seed',
  'legacy_unverified'
)
and generated_by collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
```

## Writer vocabulary

Confirmed ASCII mint:

- `source = 'rules_engine'`
- `generated_by = 'edge_function_scaffold'` from
  `private.service_create_rules_engine_ai_insight`
- Backfill / seed tokens: `mise_rules`, `staging_seed`, `legacy_unverified`

Exact-token allowlists are preserved; this tip adds the COLLATE C ASCII shape
gate alongside them.

## Why

MISE-005BS (#479) pinned `schema_version` on this table but left server
provenance on bare equality / IN only. MISE-005A proved locale drift on this
cluster. Sibling tip #482 pinned purchase-decision `evidence_version` the same
exact-token-plus-shape way; `ai_insights` provenance remained without a
dedicated COLLATE C shape gate.

## Scope

- CHECK-only on `ai_insights_server_provenance_check`
- Does **not** rewrite `private.service_create_rules_engine_ai_insight`
- Does **not** touch `schema_version` (#479) or output bounds
- Does **not** touch inventory_events identity (#478) or purchase_decision
  evidence_version (#482)
- Alone on main OK; timestamp after #482 (`20260928220000`)

## Verification

- `npm run typecheck`
- focused `tests/aiInsightProvenanceLocalePin.test.ts`
- `npm test`
- pgTAP fixture committed; Docker/hosted pgTAP not run here

## Files

- `supabase/migrations/20260928220000_mise_005bw_ai_insight_provenance_locale_pin.sql`
- `supabase/tests/database/ai_insight_provenance_locale_pin.test.sql`
- `tests/aiInsightProvenanceLocalePin.test.ts`
- `docs/automation-reports/2026-09-28-ai-insight-provenance-locale-pin.md`
