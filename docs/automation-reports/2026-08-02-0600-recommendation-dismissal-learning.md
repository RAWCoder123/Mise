# Recommendation dismissal-reason clustering (2026-08-02)

Branch: `cursor/mise-product-inspection-9e8d`  
Base tip: fast-forwarded from `origin/cursor/mise-product-inspection-f06c` (`9547286`)

## Problem

Managers can attach an optional dismiss reason when rejecting a purchase recommendation, and that text is stored server-side. Mise only emitted privacy-preserving telemetry (`dismiss_reason_present`) and did not cluster reasons, surface chronic dismissal patterns, or explain them on future recommendations.

## Implemented

1. Domain module `services/domain/recommendationDismissalLearning.ts`
   - Classify dismiss notes into `too_much_stock`, `already_ordered`, `wrong_timing`, `wrong_item`, or `other`
   - Bounded chronic feedback (window 180d, newest 8, ≥3 samples, dominant known category ≥60% and ≥3)
   - Reason fragments explain the pattern; quantity is never suppressed or rescaled from dismissals alone
2. Migration `20260802060000_recommendation_dismissal_learning_index.sql`
   - Partial index for dismissed rows that retain `dismiss_reason`
3. Operational signals / demo domain / Today tasks emit:
   - Insight `insight.rule.ordering.chronic_dismissal`
   - Today `today.ordering.chronic_dismissal` (manager, `/orders`)
4. en/es/zh-Hans presentation copy + unit/pgTAP/static security contracts

## Verification

- `npm run typecheck`
- `npm test`
- `npm run security:backend`
- `npm run security:static`
- `npm run design:static`
- Docker `supabase:test` / hosted re-proof still unavailable in this environment

## Classification

Still **controlled pilot-ready** (not App Store submission-ready). Remaining blockers are ops/credentials (Docker/hosted RLS re-proof, Auth redirects, privacy URLs, Apple/EAS, live POS/Gmail).
