# Recommendation acceptance integrity (2026-08-02)

Branch: `cursor/mise-product-inspection-e444`  
Base tip: fast-forwarded from `origin/cursor/mise-product-inspection-b97d` (`92caca9`)

## Problem

Approving a purchase recommendation with an edited quantity overwrote `recommended_quantity`, erasing what Mise originally recommended. Learning correctly uses accepted quantities, but the system could not measure operator edits, restore originals on undo, or capture optional dismiss reasons.

## Implemented

1. Migration `20260802001000_recommendation_acceptance_integrity.sql`
   - Columns: `original_recommended_quantity`, `dismiss_reason` (≤240)
   - Approve snapshots original on pending→approved; accepted qty may replace `recommended_quantity`
   - Dismiss accepts optional reason
   - Undo restores original into `recommended_quantity` and clears dismiss reason
2. Demo domain parity + repository/Edge/application wiring
3. Orders UI optional dismiss reason + scrubbed decision telemetry (`quantity_edited`, `quantity_delta_bucket`, `dismiss_reason_present`)
4. i18n (en/es/zh-Hans)
5. Unit + static security tests; dedicated pgTAP `recommendation_acceptance_integrity.test.sql`

## Verification

- `npm run typecheck` pass
- `npm test` 295 pass
- `npm run security:backend` pass
- `npm run security:static` pass
- `npm run design:static` pass
- Docker `supabase:test` / hosted re-proof still unavailable in this environment

## Classification

Still **controlled pilot-ready** (not App Store submission-ready). This closes a restaurant-learning integrity gap; remaining blockers are ops/credentials (Docker/hosted RLS re-proof, Auth redirects, privacy URLs, Apple/EAS, live POS/Gmail).
