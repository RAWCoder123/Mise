# Recipe-Authority Tenant-Denial Revalidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trigger live membership revalidation when a hosted recipe-authority RPC reports an authorization denial, while preserving the original error.

**Architecture:** Keep repository contracts, recipe authority, and Inventory behavior unchanged. Route the list and confirmation RPC failures through `throwRepositoryError(error, restaurantId)`, which classifies tenant denials, notifies the session listener with the exact restaurant ID, and rethrows the same error object.

**Tech Stack:** TypeScript, Supabase repository adapter, Node test runner, `tsx`.

## Global Constraints

- Preserve tenant isolation and existing recipe-authority rules.
- Do not change application-service, database, demo, session-context, or UI behavior.
- Do not change the direct PostgREST mutators owned by open draft PR #403.
- Do not notify for non-authorization failures.
- Rethrow the exact original repository error.

---

### Task 1: Cover and harden recipe-authority RPCs

**Files:**
- Modify: `tests/repositoryTenantAuthorization.test.ts:190-269,550-584`
- Modify: `services/repositories/supabaseRepository.ts:1437-1453`

**Interfaces:**
- Consumes: `throwRepositoryError(error: unknown, restaurantId: string | null): never`
- Produces: unchanged recipe-authority repository contracts with tenant-denial notification.

- [x] **Step 1: Write the failing runtime regression**

Add the two live recipe-authority calls to the direct authorization-operation
table:

```ts
() => repository.fetchRecipeAuthorities(restaurantId),
() => repository.confirmRecipeComplete(restaurantId, "menu-item-1", 3),
```

The table currently contributes 45 source-counted notifications. The two new
assertion call sites make the source-derived direct-path expectation 47:

```ts
assert.equal(notifications.length, 47 + coreBundleDenialNotifications);
```

Add one representative transient failure beside the existing
non-authorization assertions:

```ts
await assert.rejects(
  repository.fetchRecipeAuthorities(restaurantId),
  (error) => error === nonAuthorizationError
);
```

- [x] **Step 2: Run the focused test and observe red**

Run:

```bash
npx tsx --test tests/repositoryTenantAuthorization.test.ts
```

Expected: the first newly covered recipe-authority denial rejects with the
exact repository error but fails the one-new-notification assertion because no
tenant-denial notification was emitted.

- [x] **Step 3: Route both RPC failures through the shared boundary**

In `services/repositories/supabaseRepository.ts`, change both scoped error
branches from:

```ts
if (error) throw error;
```

to:

```ts
if (error) throwRepositoryError(error, restaurantId);
```

Apply this only to `fetchRecipeAuthorities` and `confirmRecipeComplete`.

- [x] **Step 4: Run focused and proportional verification**

Run:

```bash
npx tsx --test tests/repositoryTenantAuthorization.test.ts tests/clientTenantSafety.test.ts tests/purchaseAuthorityUi.test.ts
npm run typecheck
npm test
npm run security:backend
npm run security:static
git diff --check
```

Expected: focused tests, typecheck, full unit suite, both security checks, and
whitespace validation pass. If the known unrelated recalculation timer
cancellations reproduce, record them accurately and confirm they match the
existing PR #1183 ownership before continuing.

- [x] **Step 5: Commit the narrow implementation**

```bash
git add docs/superpowers/plans/2026-11-27-recipe-authority-tenant-denial-revalidation.md \
  services/repositories/supabaseRepository.ts \
  tests/repositoryTenantAuthorization.test.ts
git commit -m "Harden recipe authority tenant denial recovery"
```
