# MISE-005CW: pin operational_issues.status CHECK to COLLATE C

Date: 2026-09-29
Branch: `cursor/mise-operational-issues-status-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Replace the bare-IN `operational_issues.status` allowlist (`open` /
`monitoring` / `action_prepared` / `resolved` / `dismissed` / `expired`) with
the exact-token contract plus ASCII shape under COLLATE `"C"`:

```sql
status in (
  'open',
  'monitoring',
  'action_prepared',
  'resolved',
  'dismissed',
  'expired'
)
and status collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
```

## Writer vocabulary

Confirmed ASCII mint (purchase_recommendations sync trigger in
operational_backend_foundation):

- `action_prepared` — recommendation `pending` on insert; `approved` on update
- `open` — non-pending recommendation on insert
- `resolved` — recommendation `ordered` on update
- `dismissed` — recommendation `dismissed` on update
- `monitoring` — reserved allowlisted token (not minted by that sync path today)
- `expired` — reserved allowlisted token (not minted by that sync path today)

Exact-token allowlist is preserved; this tip adds the COLLATE C ASCII shape
gate alongside it.

## Why

MISE-005A proved locale drift on this cluster. Open sibling pin #456 covers
`operational_issues.dedupe_key` under a shape gate and deliberately left
`category` / `severity` / `status` on bare IN only. Category is covered by open
tip #507 (MISE-005CU). Severity is covered by open tip #508 (MISE-005CV).
Without a dedicated COLLATE C shape CHECK, dump/restore under LC_CTYPE drift
can accept issue-status bytes the restored C-locale path would refuse — or the
reverse — breaking operational-issue lifecycle across restore.

## Scope

- CHECK-only on `public.operational_issues.status`
- Does **not** rewrite the purchase_recommendations sync trigger
- Does **not** touch `category` (#507) or `severity` (#508) allowlists
- Does **not** touch `dedupe_key` (#456)
- Does **not** touch `mise_actions` / `restaurant_memories` / `activity_events`
  allowlists
- Does **not** touch `restaurant_autonomy_rules.operational_category` (#506)
- Alone on main OK; timestamp after #508 (`20260930110000`)

## Verification

- `npm run typecheck` pass
- focused `tests/operationalIssuesStatusLocalePin.test.ts` 3/3 pass
- `npm test` 679 pass / 0 fail / 7 cancelled (withTimeout baseline; includes
  the three new MISE-005CW static checks)
- pgTAP fixture committed (plan 14 from 14 assertion call sites); Docker/hosted
  pgTAP not run here

## Files

- `supabase/migrations/20260930110000_mise_005cw_operational_issues_status_locale_pin.sql`
- `supabase/tests/database/operational_issues_status_locale_pin.test.sql`
- `tests/operationalIssuesStatusLocalePin.test.ts`
- `docs/automation-reports/2026-09-29-operational-issues-status-locale-pin.md`
