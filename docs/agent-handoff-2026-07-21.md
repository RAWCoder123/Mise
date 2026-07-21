# Mise Code Review & Improvement Plan — 2026-07-21

Shared handoff document for engineering agents (Cursor / Codex) and humans.
Source: full-codebase review of the 2026-07-21 snapshot. Follow `AGENTS.md`
for standards; run `npm run typecheck` and `npm test` after every step.

## Verdict

Strong, production-minded codebase. Security and multi-tenancy are genuinely
well implemented (RLS with `security definer` helpers in a `private` schema,
PKCE OAuth for Gmail with Vault-held refresh tokens, fail-closed provider
boundaries, near-zero `any`/`@ts-ignore`, 19 test files). The weaknesses are
structural: god-modules, a domain layer coupled to demo fixtures (including
one real timezone bug), a hand-rolled 585-line session context, and
recompute-everything mutation paths.

## Strengths (do not regress)

- RLS enforced via `private.is_restaurant_member` / `private.has_restaurant_role`
  (`security definer`, `set search_path = ''`), revoked from `anon`/`public`.
- Gmail backend: S256 PKCE, least-privilege `gmail.send`, refresh tokens in
  Supabase Vault, access tokens never persisted, bounded provider-response
  parsing, CRLF-safe header sanitization (`supabase/functions/_shared/gmail.ts`).
- POS sync / AI insights fail closed (501/503) with no misleading work rows.
- Layered architecture: screens → `services/miseService.ts` (facade) →
  `services/application/` → `services/domain/` + `services/repositories/`.
- Strict TS: `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals/Parameters`.
- Defensive domain math: trimmed averages, sample-size minimums, bounded
  learned quantities, `Number.isFinite` guards.
- Request-id race guards in `contexts/MiseSessionContext.tsx`.

## Prioritized fixes

### P1 — Decouple `services/domain/` from the demo dataset  [DONE 2026-07-21]

`services/domain/miseDomain.ts` imported `DEMO_DATASET`, `DEMO_RESTAURANT_ID`,
`DEMO_RESTAURANT_TIME_ZONE`, `salesBaselines`, `isDemoDatasetRestaurantName`,
and `DemoState`, violating the "pure domain" rule in `AGENTS.md`.

- P1a: `defaultOperatingDate` and two inline ternaries gave the demo tenant
  correct timezone handling while real tenants fell back to UTC date keys —
  a real bug for any restaurant west of UTC in the evening. Fixed by
  threading the restaurant timezone (from `restaurant.timezone`) through
  domain entry points; repositories resolve it before calling domain code.
- P1b: demo `salesBaselines` fallback is now an injected
  `demandFallback?: (menuItemName: string) => number | undefined` parameter;
  only the demo repository passes it.
- P1c: `DemoState` workflow functions (`rebuildPurchaseRecommendations`,
  `rebuildInsights`, `approve/dismiss/undo RecommendationInDemoState`,
  `markSupplierOrderSentInDemoState`) moved to `services/demo/demoWorkflows.ts`.
- P1d: demo-name prose removed from domain readiness summaries; domain
  returns flags, presentation supplies demo copy.

Gate: `rg "demoData|DEMO_" services/domain/` → no matches; tests green.

### P2 — Split `services/repositories/miseRepository.ts` (2,256 lines) — DONE 2026-07-21

Split shipped as:

- `services/repositories/repositoryContracts.ts` — `MiseRepository` interface,
  input/result types, `GmailIntegrationError`, `normalizeRestaurantData`,
  `RECOMMENDATION_HISTORY_DAYS` + `recommendationHistoryCutoffIso`.
- `services/repositories/supabaseRepository.ts` — hosted backend; the only
  repository file importing `lib/supabase.ts`; owns the Gmail/workflow
  response parsers.
- `services/repositories/demoRepository.ts` — local demo backend +
  `readReadyDemoState`, `refreshLocalDemoSalesDate`, `appendDemoAuditLog`.
- `miseRepository.ts` is now a re-export facade (~25 lines); no call sites
  changed.

Also done: `setMiseRepositoryForTesting()` in
`services/application/repository.ts` (Proxy-backed so application modules
that captured the repository at import time still see swaps); the rolling
demo-sale ID contract moved next to the fixtures in
`services/demo/replaceableDemoData.ts` (`isRollingDemoCurrentDaySale`) with
named suffix constants. Source-reading security tests and
`scripts/security-static.mjs` were repointed at the new files.
Deliberately NOT done: splitting the interface into role interfaces.

### P3 — Session context: Realtime memberships + state machine

- P3a: replace the 10s `setInterval` membership poll (MiseSessionContext
  ~line 368) with a Supabase Realtime subscription on
  `restaurant_memberships` filtered by `user_id`; migration must add the
  table to `supabase_realtime` publication; add an RLS-leak test in
  `supabase/tests/database`. Keep AppState foreground revalidation; demote
  the interval to a 5-minute safety net for one release, then remove.
- P3b: refactor the provider to a single reducer-driven `SessionState`
  (`loading | signedOut | noMembership | active`); collapse the three
  request-id refs into one epoch counter. The duplicated 8-way state reset
  (clearSessionState vs revoked-membership path) is the top future-bug risk.
  Ship P3a first, soak, then P3b. No TanStack Query in the same change.

### P4 — Bound the recompute-everything mutation path — PARTIALLY DONE 2026-07-21

Every inventory/recipe edit refetches all planning data + ALL recommendation
history, rebuilds all recommendations/insights (`services/application/inventory.ts`).

1. DONE: `fetchRecommendationHistory(restaurantId)` on the repository
   interface, bounded to `RECOMMENDATION_HISTORY_DAYS` (180 — matches the
   learned-quantity lookback in `buildLearnedOrderQuantities`, so behavior
   is unchanged). Hosted backend filters with `.gte("created_at", cutoff)`;
   demo backend filters in memory. All recompute call sites in
   `services/application/inventory.ts` and
   `services/application/recalculations.ts` switched off
   `fetchPurchaseRecommendations(restaurantId, "all")`.
   Guarded by `tests/repositoryContracts.test.ts`.
   TODO when touching migrations next: add index
   `(restaurant_id, status, created_at desc)` on `purchase_recommendations`.
2. DONE EARLIER: planning sales are already bounded server-side via the
   `fetch_planning_sales` RPC (`p_service_days: 28`).
3. TODO: debounce recipe-editor saves (`app/settings/recipes.tsx`).
4. Longer term: move signal generation into the `operational-workflows`
   edge function so clients cannot fabricate signals.

### P5 — Component tests for the big screens

Add `jest-expo` + `@testing-library/react-native` (separate runner from the
existing `node --test` domain suite; match only `*.component.test.tsx`).
Priority: `app/(tabs)/today.tsx` (load/error/retry/role-gating),
`app/(tabs)/orders.tsx` + `app/orders/[id].tsx` (approve/dismiss/undo),
`app/(auth)/setup.tsx` (CSV import). Extract subcomponents to
`components/today/` as needed. Mock at the repository seam (P2's injection
hook), never mock Supabase directly.

### P6 — Unify the two i18n mechanisms

`i18n/catalog.ts` (2,630-line flat catalog, `t()`) coexists with per-screen
`Record<AppLocale, Copy>` dicts (`today.tsx` ~line 647, `settings/suppliers.tsx`).
Standardize on typed per-screen copy modules (compile-time completeness via
`satisfies`), split the catalog into per-namespace files, migrate
opportunistically when a screen is touched.

### P7 — Small hardening batch

- `createId` (weak entropy) → `expo-crypto` `randomUUID()` where non-demo.
- Simplify `shouldWarnMissingSupabaseConfig` (lib/supabase.ts) to a module bool.
- Stale-closure `user` in `switchRestaurant`/`connectDemoPOS`/`resetDemoData`
  snapshot saves (fixed by P3b's reducer; otherwise use a ref).
- Add Renovate/Dependabot with Expo-SDK-aligned grouping.

### P8 — CI orchestration

Split the `&&`-chained `verify:beta` into parallel CircleCI jobs:
typecheck | unit | audit+doctor | security+design | export→qa chain.

## UI plan (target: 2026-07 mockup, 3 panels: Today / Setup / Orders)

Already matching: app bar (menu / logo / bell / restaurant selector), color
tokens (tomato `#F5222D` on white, `#E7E7E3` borders), underline tabs
(`SegmentedControl variant="underline"`), numbered `SetupStepRail`, flat
no-shadow aesthetic, Lucide icons.

1. Type scale (constants/theme.ts): `screenTitle` 23→30/36 ls -0.4;
   `sectionTitle` stays Fraunces ~19–20; add `metricValue` (22–24 bold).  [DONE]
2. `components/ui/StatCard.tsx`: bordered card, icon top-left, muted label,
   large value, delta chip ("vs yesterday +12%" with trend icon,
   success/danger tone). Three across on Today. Keep CompactMetricStrip for
   dense contexts.  [DONE]
3. `components/ui/TrendLineChart.tsx` (~200 lines, react-native-svg, NO chart
   library): multi-series line chart, dashed comparison series, endpoint dot,
   soft-red gradient area variant; y-formatter via `useLocale`; accessible
   summary label. Feeds: Sales rhythm (Today) + Supplier spend (Orders).
4. `components/ui/ActionTile.tsx` + grid: 4 outlined square tiles
   (Scan item / New order / Inventory count / Reports), icon + label +
   small chevron, ≥44px targets.
5. `StatusNotice`: add `actionVariant: "solid"` (small filled red button) for
   the "Service needs a stock check → Review Order" banner.
   `Button`: add `soft` variant (accentSoft bg, accentDark label) for
   not-yet-enabled actions like Gmail send.
6. Supplier order card: 40px rounded-square supplier avatar (successSoft or
   brand color + initials), right-aligned total in `metricValue`, quiet line
   items, `soft` Send email + `secondary` Copy footer.
7. `EmptyState`: `framed` prop → dashed border box (Setup "No items yet").
   Optionally recolor `SetupStepRail` complete/connector from green to red.
8. Attention rows: leading 6px status dot (`inventoryStatusColors`),
   right-aligned bold value ("$1,245" / "3 items") on `OperationalRow`.

After each UI step: `npm run qa:mobile-layout` (320px overflow check) and
verify `/today`, `/inventory`, `/orders`, `/insights`, `/setup`, `/settings`.
