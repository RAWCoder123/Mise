# Purchase-decision exclude-from-learning UI

Date: 2026-08-28  
Branch: `cursor/mise-purchase-decision-exclude-learning`  
Base: `origin/main` @ `20b28e5`

## Closed

Managers can exclude the latest comparable purchase-decision evidence from
Orders learning patterns without reading raw `purchase_decision_events`.

- Reuses hosted/demo `excludePurchaseDecisionEvent` (owner/admin/manager RPC)
- Confirm dialog before compensation write
- Reloads advisory patterns after success/failure
- Staff remain read-only (no exclude control)
- Clears pattern + exclusion locks on restaurant switch
- EN / ES / zh-Hans copy
- Telemetry: `purchase_decision_excluded` (strength + sample count only)

## Paths

- `app/(tabs)/orders.tsx`
- `components/RecommendationDecisionRow.tsx`
- `i18n/catalog.ts`
- `services/telemetry.ts`
- `tests/purchaseDecisionExcludeUi.test.ts`
- `tests/purchaseDecisionMemoryBoundary.test.ts`
- `tests/ordersUi.test.ts`

## Verification

- `npm run typecheck` — pass
- `npm test` — 637 pass / 0 fail / 7 cancelled (inherited flake)
- `npm run security:static` — pass
- `npm run security:backend` — pass

## Explicitly not done

- Does not change approve/dismiss/undo authority
- Does not feed patterns into recommendation quantities (MISE-004B remains separate)
- Does not expose raw decision event payloads to the client
- Does not exclude all evidence in one tap (latest only; repeatable)
