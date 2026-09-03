# Far-past inventory ledger effective_at ceiling (2026-09-03)

## Problem

Future-dated physical counts are already rejected (MISE-001). Open stack #367
broadens that guard to every event type. The opposite failure mode remained
open on `origin/main`: an authenticated manager, direct RPC, count-session
approval path, or device outbox replay could append a ledger row with an
epoch-era or multi-year-old `effective_at`. Append-only projection and
count-boundary ordering then treat that timestamp as history, scrambling
on-hand reconstruction and purchase recommendations.

## Fix

- `securityLimits`: `INVENTORY_EVENT_EFFECTIVE_AT_MAX_LOOKBACK_DAYS = 90`
- Domain `acceptInventoryEvent` → `effective_at_too_old` when effective_at is
  older than the accept clock by more than 90 days
- Operator validation rejects far-past timestamps before RPC
- Transport maps the database rejection to a terminal outbox reason
- Additive migration `20260903160000_reject_far_past_inventory_events.sql`
  installs a BEFORE INSERT trigger (no RPC redeclare; composes with
  #367–#371 ledger guards)
- Dedicated pgTAP file avoids contested `inventory_event_ledger.test.sql`
  plan-count collisions

## Why 90 days

- Wider than purchase-authority count freshness (36 hours), so delayed offline
  sync and late delivery/waste logging remain product-safe
- Narrow enough to block epoch/year-bug timestamps and absurd backdating
- Distinct from the 2-minute future skew guard

## Do not redo

- Future-dated rejection of every type (#367)
- Quantity magnitude (#371), source_reference (#370), reason/metadata (#368)
- Inventing MOQ / lead_time / expiration

## Verification

- `npm run typecheck`
- focused domain/transport/migration/validation tests
- `npm test`
- `npm run supabase:test` when Docker is available
