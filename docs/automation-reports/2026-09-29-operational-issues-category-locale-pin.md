# MISE-005CU: pin operational_issues.category CHECK to COLLATE C

Date: 2026-09-29
Branch: `cursor/mise-operational-issues-category-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Replace the bare-IN `operational_issues.category` allowlist (`inventory` /
`orders` / `sales` / `team` / `waste` / `integrations` / `tasks` / `system`)
with the exact-token contract plus ASCII shape under COLLATE `"C"`:

```sql
category in (
  'inventory',
  'orders',
  'sales',
  'team',
  'waste',
  'integrations',
  'tasks',
  'system'
)
and category collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
```

## Writer vocabulary

Confirmed ASCII mint (purchase_recommendations sync trigger and one-time
backfill in operational_backend_foundation):

- `inventory` — purchase-recommendation inventory risk issues (current writer)
- `orders` — purchasing / supplier-order issues
- `sales` — sales / forecast issues
- `team` — staffing issues
- `waste` — waste issues
- `integrations` — POS / email connection issues
- `tasks` — task-system issues
- `system` — system / platform issues

Exact-token allowlist is preserved; this tip adds the COLLATE C ASCII shape
gate alongside it.

## Why

MISE-005A proved locale drift on this cluster. Open sibling pin #456 covers
`operational_issues.dedupe_key` under a shape gate and deliberately left
`category` / `severity` / `status` on bare IN only. Without a dedicated
COLLATE C shape CHECK, dump/restore under LC_CTYPE drift can accept
issue-category bytes the restored C-locale path would refuse — or the reverse
— breaking operational-issue grouping across restore.

## Scope

- CHECK-only on `public.operational_issues.category`
- Does **not** rewrite the purchase_recommendations sync trigger
- Does **not** touch `severity` or `status` allowlists (follow-up tips)
- Does **not** touch `dedupe_key` (#456)
- Does **not** touch `mise_actions` / `restaurant_memories` / `activity_events`
  allowlists
- Does **not** touch `restaurant_autonomy_rules.operational_category` (#506)
- Alone on main OK; timestamp after #506 (`20260930090000`)

## Verification

- `npm run typecheck` pass
- focused `tests/operationalIssuesCategoryLocalePin.test.ts` 3/3 pass
- `npm test` 679 pass / 0 fail / 7 cancelled (withTimeout baseline; includes
  the three new MISE-005CU static checks)
- pgTAP fixture committed (plan 16 from 16 assertion call sites); Docker/hosted
  pgTAP not run here

## Files

- `supabase/migrations/20260930090000_mise_005cu_operational_issues_category_locale_pin.sql`
- `supabase/tests/database/operational_issues_category_locale_pin.test.sql`
- `tests/operationalIssuesCategoryLocalePin.test.ts`
- `docs/automation-reports/2026-09-29-operational-issues-category-locale-pin.md`
