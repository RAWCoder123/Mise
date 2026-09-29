# MISE-005CC: pin restaurant_memberships role/status CHECK and writers to COLLATE C

Date: 2026-09-29
Branch: `cursor/mise-restaurant-memberships-role-status-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Replace the bare-IN `restaurant_memberships_role_check` and
`restaurant_memberships_status_check` on `public.restaurant_memberships` with
the exact-token allowlists plus ASCII shape under COLLATE `"C"`, and mirror the
same contract in `public.add_restaurant_member` and
`public.update_restaurant_member`:

```sql
role in ('owner', 'admin', 'manager', 'staff')
and role collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'

status in ('active', 'invited', 'disabled')
and status collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
```

Writer gates:

```sql
-- add_restaurant_member
p_role is null
or p_role not in ('admin', 'manager', 'staff')
or p_role collate "C" !~ '^[A-Za-z0-9._-]{1,80}$'

-- update_restaurant_member
p_role is not null and (
  p_role not in ('owner', 'admin', 'manager', 'staff')
  or p_role collate "C" !~ '^[A-Za-z0-9._-]{1,80}$'
)

p_status is not null and (
  p_status not in ('active', 'disabled')
  or p_status collate "C" !~ '^[A-Za-z0-9._-]{1,80}$'
)
```

## Writer vocabulary

Confirmed ASCII mint (authorization-critical membership identity):

- role: `owner`, `admin`, `manager`, `staff`
- status: `active`, `invited`, `disabled` (table CHECK)
- update writer status gate remains `active` / `disabled` only; `invited`
  stays table-legal for the trusted invitation workflow

Exact-token allowlists are preserved; this tip adds the COLLATE C ASCII shape
gate alongside them on both table CHECKs and the membership mutation RPCs.

## Why

MISE-005A proved locale drift on this cluster. Later 005* tips pinned
machine-identity and provenance allowlists under COLLATE C, but left membership
role/status bare-IN CHECKs and writer gates unpinned. Without a dedicated
COLLATE C shape gate, dump/restore under LC_CTYPE drift can accept
authorization-identity bytes the restored C-locale path would refuse — or the
reverse — breaking membership authorization continuity across restore.

Restaurant authority remains exclusively in active `restaurant_memberships`.

## Scope

- CHECK + writer pin on role/status allowlists /
  `add_restaurant_member` / `update_restaurant_member`
- Does **not** rewrite `remove_restaurant_member`
- Does **not** touch invite/claim stacks (#235)
- Does **not** rewrite `create_restaurant_with_owner`
- Does **not** touch contested stacks (activity_events, restaurant_memories,
  preferred_locale)
- Alone on main OK; timestamp after #488 (`20260929150000`)

## Verification

- `npm run typecheck` — pass
- focused `tests/restaurantMembershipsRoleStatusLocalePin.test.ts` — 3/3
- `npm test` — 679 pass / 0 fail / 7 cancelled (withTimeout baseline)
- pgTAP fixture committed (`plan(27)` derived from 27 assertion call sites); Docker/hosted pgTAP not run here

## Files

- `supabase/migrations/20260929150000_mise_005cc_restaurant_memberships_role_status_locale_pin.sql`
- `supabase/tests/database/restaurant_memberships_role_status_locale_pin.test.sql`
- `tests/restaurantMembershipsRoleStatusLocalePin.test.ts`
- `docs/automation-reports/2026-09-29-restaurant-memberships-role-status-locale-pin.md`
