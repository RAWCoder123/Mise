# Purchase-Recommendation Tenant-Denial Revalidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trigger live membership revalidation when a hosted purchase-recommendation workflow reports an authorization denial, while preserving the original error.

**Architecture:** Keep repository contracts and Orders behavior unchanged. Route the seven purchase-recommendation workflow failures through `throwRepositoryError(error, restaurantId)`, which classifies tenant denials, notifies the session listener with the exact restaurant ID, and rethrows the same error object.

**Tech Stack:** TypeScript, Supabase repository adapter, Node test runner, `tsx`.

## Global Constraints

- Preserve tenant isolation and existing purchase authority.
- Do not change session-context, application-service, database, demo, or UI behavior.
- Do not notify for non-authorization failures.
- Rethrow the exact original repository error.
- Keep purchase-line ledger workflows outside this slice.

---

### Task 1: Cover and harden purchase-recommendation workflows

**Files:**
- Modify: `tests/repositoryTenantAuthorization.test.ts`
- Modify: `services/repositories/supabaseRepository.ts:1456-1585`

**Interfaces:**
- Consumes: `throwRepositoryError(error: unknown, restaurantId: string | null): never`
- Produces: unchanged purchase-recommendation repository contracts with tenant-denial notification.

- [x] **Step 1: Write the failing runtime regression**

Extend `settledQuery` so the existing fake supports the update chain:

```ts
for (const method of ["select", "update", "eq", "order", "limit", "gte", "lte", "in"]) {
  query[method] = () => query;
}
```

Add these calls to the direct authorization-operation table:

```ts
() => repository.findPendingRecommendation(restaurantId, "item-1"),
() =>
  repository.createPurchaseRecommendation({
    restaurant_id: restaurantId,
    inventory_item_id: "item-1",
    item_name: "Chicken thighs",
    supplier_id: "supplier-1",
    supplier_name: "Metro Produce",
    recommended_quantity: 18,
    unit: "lb",
    reason: "Projected stockout before dinner",
    urgency: "high",
    status: "pending",
    supplier_order_id: null
  }),
() =>
  repository.updatePurchaseRecommendation(
    restaurantId,
    "recommendation-1",
    { recommended_quantity: 19 }
  ),
() => repository.approvePurchaseRecommendation(restaurantId, "recommendation-1"),
() => repository.dismissPurchaseRecommendation(restaurantId, "recommendation-1"),
() => repository.undoPurchaseRecommendationAction(restaurantId, "recommendation-1"),
() => repository.excludePurchaseDecisionEvent(restaurantId, "event-1"),
```

Update the source-derived direct-path expectation from `38` to `45`:

```ts
assert.equal(notifications.length, 45 + coreBundleDenialNotifications);
```

Add one representative non-authorization assertion beside the existing
transient-error checks:

```ts
await assert.rejects(
  repository.approvePurchaseRecommendation(restaurantId, "recommendation-1"),
  (error) => error === nonAuthorizationError
);
```

- [x] **Step 2: Run the focused test and observe red**

Run:

```bash
npx tsx --test tests/repositoryTenantAuthorization.test.ts
```

Expected: the first newly covered recommendation denial rejects with the exact
repository error but fails the one-new-notification assertion because no
tenant-denial notification was emitted.

- [x] **Step 3: Route all seven failures through the shared boundary**

In `services/repositories/supabaseRepository.ts`, replace the plain rethrow in
each scoped method with the exact restaurant-aware boundary:

```ts
if (existing.error) throwRepositoryError(existing.error, restaurantId);
```

and:

```ts
if (error) throwRepositoryError(error, restaurantId);
```

Apply the latter form to `createPurchaseRecommendation`,
`updatePurchaseRecommendation`, `approvePurchaseRecommendation`,
`dismissPurchaseRecommendation`, `undoPurchaseRecommendationAction`, and
`excludePurchaseDecisionEvent`.

- [x] **Step 4: Run focused and proportional verification**

Run:

```bash
npx tsx --test tests/repositoryTenantAuthorization.test.ts tests/clientTenantSafety.test.ts tests/demoPurchaseDecisionMemory.test.ts
npm run typecheck
npm test
npm run security:backend
npm run security:static
git diff --check
```

Expected: focused tests, typecheck, full unit suite, both security checks, and
whitespace validation pass.

- [x] **Step 5: Commit the narrow implementation**

```bash
git add docs/superpowers/plans/2026-11-27-purchase-recommendation-tenant-denial-revalidation.md \
  services/repositories/supabaseRepository.ts \
  tests/repositoryTenantAuthorization.test.ts
git commit -m "Harden recommendation tenant denial recovery"
```
