# Automation report — Identity-free archived-aware membership list

Date: 2026-08-04 ~12:00 UTC  
Branch: `cursor/mise-product-inspection-9b1d`

## Gap

Session hydration listed memberships with a direct `restaurant_memberships` table query filtered by a client-supplied `user_id`. That path:

1. did not exclude archived restaurants at list time (aligned poorly with `private.is_restaurant_member`);
2. relied on table RLS that also lets owners/admins read other members' rows;
3. could leave archived/orphaned memberships in session state even after sibling restaurant fetches were dropped.

## Fix

1. Migration `20260804120000_list_my_restaurant_memberships.sql` — pure `list_my_restaurant_memberships()` RPC bound to `auth.uid()`, active status only, `restaurants.archived_at is null`.
2. Hosted repository uses the RPC; demo repository filters archived restaurants locally.
3. `resolveMultiMembershipHydration` drops archived restaurants defense-in-depth and returns `loadableMemberships`.
4. Session `setMemberships(loadableMemberships)` so the workspace switcher never retains dropped/archived memberships.

## Tests

- `tests/membershipListPurity.test.ts`
- `tests/sessionHydration.test.ts` — archived drop + loadable memberships
- `tests/security.test.ts` — migration/RPC/hosted pin
- `supabase/tests/database/list_my_restaurant_memberships.test.sql` (pgTAP; Docker-gated here)

## Classification

Still controlled pilot-ready pending Docker/hosted gates; not App Store submission-ready.
