# POS Settings Tenant-Denial Revalidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trigger live membership revalidation when either hosted POS-settings read reports an authorization denial, while preserving the original error.

**Architecture:** Keep the existing repository contract and POS screens unchanged. Route failures from `fetchSquarePosIntegration` and `fetchPosMappingReviewQueue` through the shared `throwRepositoryError(error, restaurantId)` boundary, which classifies tenant-denial errors, notifies the session listener with the exact restaurant ID, and rethrows the same error object.

**Tech Stack:** TypeScript, Supabase repository adapter, Node test runner, `tsx`.

## Global Constraints

- Preserve tenant isolation and existing Mise branding.
- Do not change session-context or POS-screen behavior in this slice.
- Do not notify for non-authorization failures.
- Rethrow the exact original repository error.

---

### Task 1: Cover and harden POS-settings reads

**Files:**
- Modify: `tests/repositoryTenantAuthorization.test.ts`
- Modify: `services/repositories/supabaseRepository.ts`

**Interfaces:**
- Consumes: `throwRepositoryError(error: unknown, restaurantId: string | null): never`
- Produces: unchanged `fetchSquarePosIntegration(restaurantId)` and `fetchPosMappingReviewQueue(restaurantId)` repository contracts with tenant-denial notification.

- [ ] **Step 1: Write the failing regression**

Add both calls to the authorization-notification operation table:

```ts
() => repository.fetchSquarePosIntegration(restaurantId),
() => repository.fetchPosMappingReviewQueue(restaurantId),
```

Update the final exact notification count from `35` to `37`.

- [ ] **Step 2: Run the focused test and observe red**

Run:

```bash
npx tsx --test tests/repositoryTenantAuthorization.test.ts
```

Expected: the first newly covered POS-settings denial rethrows the original error but fails the `notificationsBeforeOperation + 1` assertion because no notification was emitted.

- [ ] **Step 3: Route both errors through the shared boundary**

Replace each plain rethrow with:

```ts
if (error) throwRepositoryError(error, restaurantId);
```

- [ ] **Step 4: Run focused and proportional verification**

Run:

```bash
npx tsx --test tests/repositoryTenantAuthorization.test.ts tests/clientTenantSafety.test.ts tests/posMappingReviewWorkflow.test.ts
npm run typecheck
npm test
npm run security:backend
npm run security:static
git diff --check
```

Expected: all focused tests, typecheck, full unit suite, security checks, and whitespace validation pass.

- [ ] **Step 5: Commit the narrow change**

```bash
git add docs/superpowers/plans/2026-11-26-pos-settings-tenant-denial-revalidation.md \
  services/repositories/supabaseRepository.ts \
  tests/repositoryTenantAuthorization.test.ts
git commit -m "Harden POS settings tenant denial recovery"
```
