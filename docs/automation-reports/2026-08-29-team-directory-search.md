# Team directory ranked search (2026-08-29)

Branch: `cursor/mise-team-directory-search`
Base: `origin/main` @ `20b28e5`

## Problem

Settings → Team listed every membership with no find control. Larger restaurants force
owners and admins to scroll the full directory to locate a teammate before changing
role or removing access.

## Fix

- Domain `filterTeamDirectoryBySearch` ranks name, email, role, and membership status
  without inventing rows; empty query preserves caller order.
- Search UI appears at six or more loaded members, shows shown/total counts, and an
  empty state when nothing matches.
- EN / ES / zh-Hans catalog keys for accessibility, placeholder, meta, and empty copy.

## Tests

- `tests/teamDirectorySearch.test.ts`
- `npm run typecheck`
- targeted domain + localization checks; `npm test`
