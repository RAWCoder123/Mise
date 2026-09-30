# MISE-005DH: pin ai_insights.status CHECK to COLLATE C

Date: 2026-09-30
Branch: `cursor/mise-ai-insights-status-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Replace the bare-IN `ai_insights.status` allowlist (`generated` / `reviewed` /
`dismissed` / `applied`) with the exact-token contract plus ASCII shape under
COLLATE `"C"`:

```sql
status in ('generated', 'reviewed', 'dismissed', 'applied')
and status collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
```

## Writer vocabulary

Confirmed ASCII mint (`types/mise.ts` `AiInsightStatus`, restaurant-ops
backbone create-table allowlist, `private.service_create_rules_engine_ai_insight`
defaulting new rows to `generated`):

- `generated` — newly minted insight awaiting operator review
- `reviewed` — operator reviewed the insight without applying
- `dismissed` — operator dismissed the insight
- `applied` — operator applied the recommended action

Exact-token allowlist is preserved; this tip adds the COLLATE C ASCII shape
gate alongside it.

## Why

MISE-005A proved locale drift on this cluster. Open sibling pins #483
(provenance) and #479 (schema_version) leave `ai_insights.status` on bare IN
only. Without a dedicated COLLATE C shape CHECK, dump/restore under LC_CTYPE
drift can accept insight lifecycle bytes the restored C-locale path would
refuse — or the reverse — breaking AI insight continuity across restore.

## Scope

- CHECK-only on `public.ai_insights.status`
- Does **not** rewrite `private.service_create_rules_engine_ai_insight`
- Does **not** touch provenance (#483) or schema_version (#479)
- Does **not** touch `risk_level` (still bare IN; candidate for a later tip)
- Alone on main OK; timestamp after #519 (`20260930220000`)

## Verification

- `npm run typecheck` pass
- focused `tests/aiInsightsStatusLocalePin.test.ts` 3/3 pass
- `npm test` 679 pass / 0 fail / 7 cancelled (inherited cancelledByParent noise; new
  MISE-005DH cases pass)
- pgTAP fixture committed (plan 12 from 12 assertion call sites); Docker/hosted
  pgTAP not run here

## Files

- `supabase/migrations/20260930220000_mise_005dh_ai_insights_status_locale_pin.sql`
- `supabase/tests/database/ai_insights_status_locale_pin.test.sql`
- `tests/aiInsightsStatusLocalePin.test.ts`
- `docs/automation-reports/2026-09-30-ai-insights-status-locale-pin.md`
