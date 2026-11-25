# Inventory Count Fail-Closed Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide stale inventory-count session data and visibly block session creation whenever the restaurant-scoped refresh is not ready.

**Architecture:** Reuse `resolveRestaurantScopedHubLoadState` as the single readiness authority already present on the screen. Gate both cached detail presentation and the start-session button from the derived readiness values without changing service, repository, or domain contracts.

**Tech Stack:** React Native, Expo Router, TypeScript, Node test runner.

## Global Constraints

- Preserve the request-generation and active-restaurant checks.
- Preserve cached detail and draft values across a soft-refresh error; hide them rather than destroying them.
- Add no dependencies, schema changes, service API changes, or localization copy.
- Follow test-driven development: verify the source-contract regression fails before editing production code.

---

### Task 1: Fail-closed inventory-count presentation

**Files:**
- Modify: `tests/hubLoadState.test.ts`
- Modify: `app/inventory/count.tsx`

**Interfaces:**
- Consumes: `resolveRestaurantScopedHubLoadState({ restaurantId, loadedRestaurantId, loadError })` and `presentRestaurantScopedHubActionsEditable({ allowed, hubReady, busy })`.
- Produces: `visibleDetail: InventoryCountSessionDetail | null`, derived from `hubReady`, and a start-session button disabled whenever `actionsEditable` is false.

- [ ] **Step 1: Write the failing source-contract test**

Add `"app/inventory/count.tsx"` to `HUB_CONSUMER_FILES`, then add:

```ts
test("inventory count hides stale session data and blocks start while the hub is not ready", () => {
  const source = readFileSync("app/inventory/count.tsx", "utf8");

  assert.match(source, /const \[hubLoadError, setHubLoadError\] = useState\(false\);/);
  assert.match(source, /loadError: hubLoadError/);
  assert.doesNotMatch(source, /loadError: Boolean\(error\)/);
  assert.match(source, /const visibleDetail = hubReady \? detail : null;/);
  assert.match(source, /\{hubReady &&[\s\n]*\(\s*!visibleDetail/);
  assert.match(
    source,
    /title=\{t\("inventory\.count\.startAction"\)\}[\s\n]+onPress=\{\(\) => void startSession\(\)\}[\s\n]+disabled=\{!actionsEditable\}/
  );
});
```

- [ ] **Step 2: Run the focused test and verify the expected failure**

Run:

```bash
node --test --import tsx tests/hubLoadState.test.ts
```

Expected: FAIL in
`inventory count hides stale session data and blocks start while the hub is not ready`
because the pre-fix screen has no dedicated `hubLoadError` state, couples hub
readiness to `Boolean(error)`, derives `visibleDetail` from `loadedRestaurantId`
alone, and leaves the start panel and start button ungated on hub readiness.

- [ ] **Step 3: Gate detail and the start button with shared readiness**

In `app/inventory/count.tsx`:

- Add `const [hubLoadError, setHubLoadError] = useState(false);`
- In the restaurant-change `useEffect`, set `hubLoadError` to `false`
- In `load()`: set `hubLoadError` to `false` when the load starts; set
  `hubLoadError` to `false` after a successful fetch; in the load `catch`, set
  `hubLoadError` to `true` only and do not clear cached `detail` or drafts
- Pass `loadError: hubLoadError` into `resolveRestaurantScopedHubLoadState`
- Derive hub state before visible detail:

```ts
const hubLoadState = resolveRestaurantScopedHubLoadState({
  restaurantId: restaurant?.id,
  loadedRestaurantId,
  loadError: hubLoadError
});
const hubReady = hubLoadState === "ready";
const visibleDetail = hubReady ? detail : null;
const actionsEditable = presentRestaurantScopedHubActionsEditable({
  allowed: canDraft,
  hubReady,
  busy: saving
});
```

Replace the start-panel condition with:

```tsx
{hubReady &&
(!visibleDetail ||
  visibleDetail.session.status === "approved" ||
  visibleDetail.session.status === "cancelled") ? (
```

Replace the start-session control with:

```tsx
<Button
  title={t("inventory.count.startAction")}
  onPress={() => void startSession()}
  disabled={!actionsEditable}
  fullWidth
  accessibilityLabel={t("inventory.count.startAccessibility")}
/>
```

Render the in-progress session surface only when `hubReady && visibleDetail`.

- [ ] **Step 4: Run the focused test and verify it passes**

Run:

```bash
node --test --import tsx tests/hubLoadState.test.ts
```

Expected: all tests in `tests/hubLoadState.test.ts` PASS.

- [ ] **Step 5: Run proportionate regression checks**

Run:

```bash
node --test --import tsx tests/hubLoadState.test.ts tests/clientTenantSafety.test.ts tests/inventoryCountSessions.test.ts
npm run typecheck
npm run security:static
npm run security:backend
npm run design:static
npm run qa:routes
npm run qa:mobile-layout
```

Expected: every command exits 0; route and mobile-layout smoke tests report no horizontal overflow.

- [ ] **Step 6: Commit the implementation**

```bash
git add tests/hubLoadState.test.ts app/inventory/count.tsx
git commit -m "fix: fail closed inventory count refresh errors"
```
