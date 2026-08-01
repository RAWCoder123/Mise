# Revoke residual membership and profile DML grants

Date: 2026-08-01
Branch: `cursor/mise-product-inspection-e467`
Base tip: `dbb0d89` (`cursor/mise-product-inspection-86e2`)

## Problem

Write policies for `public.restaurant_memberships` and `public.users` were dropped when mutations moved to guarded RPCs/Edge workflows, but table privilege grants from early scaffolding remained:

- `authenticated` still had `INSERT`/`UPDATE`/`DELETE` on `restaurant_memberships`
- `authenticated` still had column `UPDATE (name)` on `users`

pgTAP already expected those privileges to be false (`membership inserts are RPC-only`, `legacy user profile updates are RPC-only`). Residual grants would fail Docker `supabase:test` and leave a least-privilege gap even though RLS write policies were absent.

## Fix

Migration `20260801211000_revoke_membership_and_profile_dml.sql`:

- Revokes authenticated DML on `restaurant_memberships` (SELECT remains for roster reads).
- Revokes authenticated `UPDATE` on `users` (profile/locale mutations stay service/Edge owned).
- Documents the final ownership model on both tables.

Static security tests now assert the revoke migration and the matching pgTAP probes.

## Verification

- `npm run typecheck`
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`

Docker pgTAP execution and hosted staging re-proof remain environment-blocked in this workspace.

## Classification impact

Still **controlled pilot-ready code** pending Docker + hosted security gate re-run. Not App Store submission-ready.
