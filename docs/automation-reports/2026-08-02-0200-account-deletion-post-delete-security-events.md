# Account deletion post-Auth-delete security events (2026-08-02)

Branch: `cursor/mise-product-inspection-3a96`  
Base tip: fast-forwarded from `origin/cursor/mise-product-inspection-48f0` (`c9ee3ae`)

## Problem

`request-account-deletion` hard-deletes `auth.users` before finalizing its user-scoped firewall security event. The reservation row’s `actor_user_id` is `ON DELETE SET NULL`, so:

1. `record_user_scoped_edge_function_security_event` could not match the reservation by actor id;
2. inserting a terminal row with the deleted user id violated the `auth.users` FK;
3. the Edge catch path could return a client-visible failure even though Auth deletion already succeeded — a privacy-critical App Store workflow failure mode.

## Implemented

1. Migration `20260802020000_account_deletion_post_delete_security_events.sql`
   - Reservations store immutable `reserved_actor_user_id` metadata
   - Rate-limit counting also considers reserved/deleted actor metadata after FK nulling
   - `request-account-deletion` terminal events may match nulled reservations via metadata and insert with `actor_user_id = null` plus `deleted_actor_user_id`
2. Edge `request-account-deletion` treats Auth hard-delete as the success boundary; secondary status/finalize failures no longer convert a completed deletion into a client error
3. pgTAP probes in `account_deletion.test.sql` for reserve → delete auth user → finalize completed
4. Static/backend security gate coverage for the post-delete path
5. App Store checklist note updated

## Verification

- `npm run typecheck`
- `npm test`
- `npm run security:backend`
- `npm run security:static`
- `npm run design:static`
- Docker `supabase:test` / hosted re-proof still unavailable in this environment

## Classification

Still **controlled pilot-ready** (not App Store submission-ready). This closes an App Store account-deletion reliability/security-audit gap; remaining blockers are ops/credentials (Docker/hosted RLS re-proof, Auth redirects, privacy URLs, Apple/EAS, live POS/Gmail).
