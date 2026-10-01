# Purchase recommendation reason i18n (2026-08-30)

## Gap
Orders and Home rendered frozen English `PurchaseRecommendation.reason` prose
(`May run out today…`) even when the operator locale was ES or zh-Hans.

## Change
- Emit locale-neutral `presentation` descriptors on Mise-generated recommendations
- Present reasons at render time via `presentPurchaseRecommendationReason`
- Synthesize from urgency + structured fields when hosted storage strips presentation
- Keep English `reason` as audit/evidence fallback only

## Verification
- `npm run typecheck`
- `npm test` (targeted + full suite)
- `npm run security:static` when available
