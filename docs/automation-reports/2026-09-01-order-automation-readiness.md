# Order automation readiness on Autonomy (2026-09-01)

## Gap
`assessOrderAutomation` and `fetchOrderAutomationAssessment` already computed
evidence-gated draft/send readiness, but:

- the application path never passed inventory ledger evidence, so count freshness
  always fail-closed as stale;
- Autonomy settings only edited rules and never showed why a supplier was or was
  not automation-ready;
- operators could not tell whether pending recommendations met history, cost,
  count, delivery, or spend gates.

## Fix
- `deriveOrderAutomationPolicy` / `summarizeOrderAutomationReadiness` in
  `services/domain/orderAutomation.ts` map autonomy rules into the read-only
  automation policy (send stays approval-gated).
- `fetchOrderAutomationAssessment` and new
  `fetchRestaurantOrderAutomationReadiness` load ledger evidence + autonomy
  rules, assess each supplier with pending recommendations, and never draft or
  send.
- `services/presentation/orderAutomationPresentation.ts` maps decisions and
  blockers to i18n keys.
- Settings → Autonomy shows an evidence-only readiness section (EN/ES/zh-Hans)
  with fail-closed load handling that does not invent ready claims.

## Proof
- `npm run typecheck`
- `node --import tsx --test tests/orderAutomationReadiness.test.ts tests/orderAutomation.test.ts`
- `npm test` (focused + suite)
- `npm run security:static` / `npm run design:static` when available

## Non-goals
- Enabling automatic draft/send execution
- Ingredient substitutions CRUD / yield write RPCs (Codex)
- Inventing MOQ / lead time / expiration columns
