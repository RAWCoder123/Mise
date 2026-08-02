# Acceptance-edit delta learning (2026-08-02)

Branch: `cursor/mise-product-inspection-f06c`  
Base tip: fast-forwarded from `origin/cursor/mise-product-inspection-4ed8` (`a750991`)

## Problem

Recommendation acceptance integrity already preserved `original_recommended_quantity` when managers approved an edited quantity, and absolute accepted-quantity median learning already existed. Mise still did not learn the *edit ratio* (accepted ÷ original), so systematic approve-time drift transferred poorly when baselines changed and could double-count with absolute medians.

## Implemented

1. Domain module `services/domain/acceptanceEditLearning.ts`
   - Extract approved/ordered samples with original + accepted quantities
   - Bounded chronic bias (window 180d, newest 8, ≥3 samples, winsorize `[0.5,1.5]`, multiplier `[0.8,1.25]`)
   - Chronic increase when median ratio ≥ 1.08 with ≥3 upward edits; decrease when ≤ 0.92 with ≥3 downward edits
2. Migration `20260802050000_acceptance_edit_learning_index.sql`
   - Partial index for approved/ordered rows that retain originals
3. Stacked learning prefers acceptance-edit ratio over absolute accepted median (avoids double-counting), then receive → waste → count shrink → manager correction
4. Insight `insight.rule.ordering.chronic_acceptance_edit` + Today `today.ordering.chronic_acceptance_edit` (manager, `/orders`)
5. en/es/zh-Hans presentation copy + unit/pgTAP/static security contracts

## Verification

- `npm run typecheck`
- `npm test`
- `npm run security:backend`
- `npm run security:static`
- `npm run design:static`
- Docker `supabase:test` / hosted re-proof still unavailable in this environment

## Classification

Still **controlled pilot-ready** (not App Store submission-ready). Remaining blockers are ops/credentials (Docker/hosted RLS re-proof, Auth redirects, privacy URLs, Apple/EAS, live POS/Gmail).
