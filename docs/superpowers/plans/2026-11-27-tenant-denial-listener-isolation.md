# Tenant-Denial Listener Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve the exact repository authorization error and notify every subscriber even when one tenant-denial listener throws.

**Architecture:** Keep tenant-denial notification synchronous so membership revalidation still starts before the repository error reaches the screen. Contain each listener independently, report its failure through Mise's existing bounded telemetry boundary, continue notifying later listeners, and then let `throwRepositoryError` rethrow the exact original repository error.

**Tech Stack:** TypeScript, Node test runner, `tsx`, existing Mise telemetry.

## Global Constraints

- Preserve tenant isolation and the existing repository API.
- Do not modify `contexts/MiseSessionContext.tsx`, which is owned by open PR #170.
- Never replace or wrap the original repository error.
- A failed listener must not prevent later listeners from receiving the exact restaurant ID.
- Telemetry failure must never block the authorization path.

---

### Task 1: Prove and isolate tenant-denial listener failures

**Files:**
- Modify: `tests/repositoryTenantAuthorization.test.ts`
- Modify: `services/tenantAuthorizationEvents.ts`

**Interfaces:**
- Consumes: `captureMiseError(error: unknown, context?: TelemetryProperties): void`
- Produces: unchanged `notifyTenantAuthorizationDenied(restaurantId?: string | null): void`
- Produces: unchanged `throwRepositoryError(error: unknown, restaurantId?: string | null): never`

- [x] **Step 1: Write the failing regression**

Import the broadcaster functions and register a throwing listener before a healthy listener:

```ts
import {
  isTenantAuthorizationError,
  subscribeToTenantAuthorizationDenials,
  throwRepositoryError
} from "../services/tenantAuthorizationEvents";

test("tenant authorization notification isolates listener failures and preserves the repository error", () => {
  const listenerError = new Error("listener failed");
  const notifications: Array<string | null> = [];
  const unsubscribeFailing = subscribeToTenantAuthorizationDenials(() => {
    throw listenerError;
  });
  const unsubscribeHealthy = subscribeToTenantAuthorizationDenials((deniedRestaurantId) => {
    notifications.push(deniedRestaurantId);
  });

  try {
    assert.throws(
      () => throwRepositoryError(permissionError, restaurantId),
      (error) => error === permissionError
    );
    assert.deepEqual(notifications, [restaurantId]);
  } finally {
    unsubscribeHealthy();
    unsubscribeFailing();
  }
});
```

- [x] **Step 2: Run the focused test and observe red**

Run:

```bash
npx tsx --test tests/repositoryTenantAuthorization.test.ts
```

Expected: FAIL because the first listener's `listenerError` escapes, masks `permissionError`, and prevents the healthy listener from running.

- [x] **Step 3: Contain each listener independently**

Import `captureMiseError` and replace the direct listener loop:

```ts
import { captureMiseError } from "./telemetry";

export function notifyTenantAuthorizationDenied(restaurantId: string | null = null) {
  for (const listener of listeners) {
    try {
      listener(restaurantId);
    } catch (error) {
      try {
        captureMiseError(error, {
          operation: "tenant_authorization_denial_listener",
          restaurant_id: restaurantId ?? undefined
        });
      } catch {
        // Error reporting must never block tenant-denial recovery.
      }
    }
  }
}
```

- [x] **Step 4: Run focused and proportional verification**

Run:

```bash
npx tsx --test tests/repositoryTenantAuthorization.test.ts tests/clientTenantSafety.test.ts tests/telemetryCorrelation.test.ts
npm run typecheck
npm test
npm run security:backend
npm run security:static
git diff --check
```

Expected: focused tests, typecheck, the full unit suite, both security checks, and whitespace validation all pass.

- [x] **Step 5: Commit the narrow change**

```bash
git add docs/superpowers/plans/2026-11-27-tenant-denial-listener-isolation.md \
  services/tenantAuthorizationEvents.ts \
  tests/repositoryTenantAuthorization.test.ts
git commit -m "Isolate tenant denial listener failures"
```
