# Inventory hub Needs verification filter

Date: 2026-08-31  
Branch: `cursor/mise-inventory-needs-verification-filter`  
Base: `origin/main` @ `20b28e5`

## Problem

Inventory rows already labeled unverified canonical units as “needs verification,” but the hub had no way to isolate those items. Operators hunting blocked count/receive/waste work had to scroll mixed stock lists. Open PR #187 adds detail-side verification; this hub filter complements it without touching contested inventory detail.

## Change

- Added `services/presentation/inventoryHubPresentation.ts` with:
  - `isInventoryCanonicalUnitReady`
  - `matchesInventoryHubFilter` (stock filters + Needs verification)
  - `listNeedsVerificationOutlooks`
- Inventory hub:
  - Preview group for unverified items (top 3) with View all → Verify filter
  - Segment filter option **Verify** / Needs verification
- Localized EN / ES / zh-Hans filter + group copy
- Tests: presentation unit tests + UI wiring pin tests

## Verification

- `npm run typecheck` — pass
- `npm test` — 637 pass / 0 fail / 7 cancelled (pre-existing)
- No migrations; no contested inventory detail / receive paths

## Classification impact

Still **controlled pilot-ready**. Improves discoverability of a known inventory authority gap; verification write UI remains on #187.
