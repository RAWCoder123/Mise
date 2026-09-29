# MISE-005CV: pin operational_issues.severity CHECK to COLLATE C

Date: 2026-09-29
Branch: `cursor/mise-operational-issues-severity-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Replace the bare-IN `operational_issues.severity` allowlist (`info` / `watch` /
`warning` / `critical`) with the exact-token contract plus ASCII shape under
COLLATE `"C"`:

```sql
severity in (
  'info',
  'watch',
  'warning',
  'critical'
)
and severity collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
```

## Writer vocabulary

Confirmed ASCII mint (purchase_recommendations sync trigger in
operational_backend_foundation):

- `critical` — urgency `high`
- `warning` — urgency `medium`
- `watch` — all other urgency values
- `info` — reserved allowlisted token (not minted by that sync path today)

Exact-token allowlist is preserved; this tip adds the COLLATE C ASCII shape
gate alongside it.

## Why

MISE-005A proved locale drift on this cluster. Open sibling pin #456 covers
`operational_issues.dedupe_key` under a shape gate and deliberately left
`category` / `severity` / `status` on bare IN only. Category is covered by open
tip #507 (MISE-005CU). Without a dedicated COLLATE C shape CHECK, dump/restore
under LC_CTYPE drift can accept issue-severity bytes the restored C-locale path
would refuse — or the reverse — breaking operational-issue prioritization
across restore.

## Scope

- CHECK-only on `public.operational_issues.severity`
- Does **not** rewrite the purchase_recommendations sync trigger
- Does **not** touch `category` or `status` allowlists (follow-up tips)
- Does **not** touch `dedupe_key` (#456)
- Does **not** touch `mise_actions` / `restaurant_memories` / `activity_events`
  allowlists
- Does **not** touch `restaurant_autonomy_rules.operational_category` (#506)
- Alone on main OK; timestamp after #507 (`20260930100000`)

## Verification

- `npm run typecheck` pass
- focused `tests/operationalIssuesSeverityLocalePin.test.ts` 3/3 pass
- `npm test` 679 pass / 0 fail / 7 cancelled (withTimeout baseline; includes
  the three new MISE-005CV static checks)
- pgTAP fixture committed (plan 12 from 12 assertion call sites); Docker/hosted
  pgTAP not run here

## Files

- `supabase/migrations/20260930100000_mise_005cv_operational_issues_severity_locale_pin.sql`
- `supabase/tests/database/operational_issues_severity_locale_pin.test.sql`
- `tests/operationalIssuesSeverityLocalePin.test.ts`
- `docs/automation-reports/2026-09-29-operational-issues-severity-locale-pin.md`
