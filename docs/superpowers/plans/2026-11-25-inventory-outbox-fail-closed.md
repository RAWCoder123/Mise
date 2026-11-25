# Inventory Outbox Fail-Closed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop permanent inventory authorization and idempotency failures from masquerading as retryable network outages.

**Architecture:** Keep repository transport behavior and the existing outbox state machine unchanged. Classify only errors thrown across the inventory outbox submission boundary: authorization failures settle as `rejected`, idempotency payload mismatches settle as `conflict`, and all unknown transport failures retain the existing deferred retry path.

**Tech Stack:** TypeScript 6, Node test runner, `tsx`, Expo/React Native application services.

## Global Constraints

- Keep screen-facing APIs stable in `services/miseService.ts`.
- Preserve local demo mode and hosted Supabase behavior.
- Never present a permanent failure as pending work.
- Do not change database schema, tenant permissions, or inventory event identity.
- Run `npm run typecheck` after TypeScript changes and focused/full tests in proportion to risk.

---

### Task 1: Settle permanent inventory submission failures

**Files:**
- Modify: `tests/inventoryOutboxApplication.test.ts`
- Modify: `services/application/inventoryOutbox.ts`

**Interfaces:**
- Consumes: `isTenantAuthorizationError(error: unknown): boolean`, `settleInventoryOutboxSubmission(...)`, and the existing `InventoryEventAcceptance` union.
- Produces: unchanged `flushInventoryOutbox(input): Promise<InventoryOutboxFlushSummary>` behavior with terminal classification for thrown authorization and idempotency errors.

- [ ] **Step 1: Write the failing behavior test**

Add a table-driven test that creates a fresh outbox for each scenario, makes `submit` throw, and expects terminal persistence:

```ts
test("permanent submission failures settle visibly instead of retrying", async () => {
  for (const scenario of [
    {
      error: Object.assign(new Error("permission denied"), { code: "42501" }),
      status: "rejected",
      reason: "permission_denied",
      summaryKey: "rejected"
    },
    {
      error: new Error("Inventory event idempotency conflict"),
      status: "conflict",
      reason: "idempotency_payload_mismatch",
      summaryKey: "conflicted"
    }
  ] as const) {
    const repository = createInventoryOutboxRepository(memoryStorage());
    await repository.save(
      createInventoryOutboxEntry({
        id: `outbox-${scenario.status}`,
        event: event(`client-${scenario.status}`),
        now: "2026-07-26T10:00:00.000Z"
      })
    );

    const summary = await flushInventoryOutbox({
      restaurantId: "restaurant-a",
      repository,
      submit: async () => {
        throw scenario.error;
      },
      now: () => "2026-07-26T10:00:02.000Z"
    });
    const [settled] = await repository.list("restaurant-a");

    assert.equal(summary[scenario.summaryKey], 1);
    assert.equal(summary.deferred, 0);
    assert.equal(settled?.status, scenario.status);
    assert.equal(settled?.resolutionReason, scenario.reason);
    assert.equal(settled?.nextAttemptAt, null);
  }
});
```

- [ ] **Step 2: Run the focused test and confirm the red state**

Run:

```bash
npx tsx --test tests/inventoryOutboxApplication.test.ts
```

Expected: the new test fails because both thrown errors currently become `pending` with `network_retry`.

- [ ] **Step 3: Add minimal classification at the submission boundary**

In `services/application/inventoryOutbox.ts`, import `isTenantAuthorizationError` and classify thrown failures before the existing defer branch:

```ts
function inventorySubmissionFailureFromError(
  error: unknown
): InventoryEventAcceptance | null {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String(error.message)
        : "";

  if (/idempotency.*conflict|payload.*mismatch/i.test(message)) {
    return {
      status: "conflict",
      reason: "idempotency_payload_mismatch",
      existingEvent: null
    };
  }
  if (isTenantAuthorizationError(error)) {
    return { status: "rejected", reason: "permission_denied" };
  }
  return null;
}
```

In the `catch`, assign this terminal acceptance when present; otherwise keep `deferInventoryOutboxSubmission` and `summary.deferred` exactly as they are. Allow the existing shared settlement and summary logic to persist the terminal result.

- [ ] **Step 4: Run focused regression tests**

Run:

```bash
npx tsx --test tests/inventoryOutboxApplication.test.ts tests/deviceInventoryOutbox.test.ts tests/inventoryOutbox.test.ts
```

Expected: all focused tests pass, including the pre-existing ambiguous network retry case.

- [ ] **Step 5: Run repository verification**

Run:

```bash
npm run typecheck
npm test
npm run security:backend
npm run security:static
```

Expected: typecheck and security checks pass. All assertions pass; if the known `withTimeout` cancellation reproduces, verify that it matches the documented inherited failure with zero assertion failures.

- [ ] **Step 6: Commit the focused change**

```bash
git add docs/superpowers/plans/2026-11-25-inventory-outbox-fail-closed.md \
  services/application/inventoryOutbox.ts \
  tests/inventoryOutboxApplication.test.ts
git commit -m "fix inventory outbox permanent failure handling"
```
