import assert from "node:assert/strict";
import test from "node:test";

import {
  DEMO_RESTAURANT_ID,
  createInitialDemoState,
  repairDemoState
} from "../services/demo/replaceableDemoData";

test("fresh demo workspaces seed purchase lines with attention evidence", () => {
  const state = createInitialDemoState("Square", undefined, new Date("2026-11-11T15:00:00.000Z"));

  assert.equal(state.schema_version, 14);
  assert.equal(state.purchaseLines.length, 5);

  const poultryInvoice = state.purchaseLines.filter(
    (line) => line.sourceDocumentReference === "INV-DEMO-1043"
  );
  assert.equal(poultryInvoice.length, 2);
  assert.equal(
    poultryInvoice.find((line) => line.lineIndex === 1)?.parseConfidence,
    "could_not_verify",
    "unpriced seed line stays visible as could_not_verify"
  );

  const unmatchedCredit = state.purchaseLines.find(
    (line) => line.sourceDocumentReference === "CM-DEMO-2201"
  );
  assert.equal(unmatchedCredit?.lineType, "credit");
  assert.notEqual(
    unmatchedCredit?.normalizedItemKey,
    poultryInvoice.find((line) => line.lineIndex === 0)?.normalizedItemKey,
    "credit wording stays distinct so netting cannot invent a match"
  );

  const attention = state.activityEvents.find(
    (event) =>
      event.activityType === "purchase_lines_recorded" &&
      event.relatedEntityId === "INV-DEMO-1043"
  );
  assert.ok(attention, "seeded poultry invoice emits purchase_lines_recorded activity");
  assert.equal(attention.requiresAttention, true);
  assert.equal(attention.metadata.couldNotVerifyCount, 1);
});

test("schema 14 repair fills empty purchase-line ledgers once without wiping ingest history", async () => {
  const values = new Map<string, string>();
  (globalThis as unknown as { window: { localStorage: Storage } }).window = {
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        values.set(key, value);
      },
      removeItem: (key) => {
        values.delete(key);
      },
      clear: () => {
        values.clear();
      },
      key: (index) => [...values.keys()][index] ?? null,
      get length() {
        return values.size;
      }
    }
  };

  const legacy = createInitialDemoState("Square", undefined, new Date("2026-11-10T15:00:00.000Z"));
  const emptyLegacy = {
    ...legacy,
    schema_version: 13,
    purchaseLines: [],
    activityEvents: []
  } as unknown as Parameters<typeof repairDemoState>[0];

  const repaired = repairDemoState(emptyLegacy);
  assert.equal(repaired.migrated, true);
  assert.equal(repaired.state.schema_version, 14);
  assert.equal(repaired.state.purchaseLines.length, 5);
  assert.ok(
    repaired.state.activityEvents.some(
      (event) =>
        event.activityType === "purchase_lines_recorded" && event.requiresAttention === true
    )
  );

  const { createLocalDemoRepository } = await import("../services/repositories/demoRepository");
  const repository = createLocalDemoRepository();
  await repository.resetDemoData(null);

  const before = await repository.fetchPurchaseLines(DEMO_RESTAURANT_ID);
  assert.ok(before.length >= 5);

  const nets = await repository.fetchPurchaseLineNetByItem(DEMO_RESTAURANT_ID);
  assert.ok(
    nets.some((group) => group.unmatchedCredit === true),
    "seeded credit wording remains an unmatched credit group"
  );

  // Operator-empty after schema 14 must stay empty — repair is not a reseed loop.
  const emptied = repairDemoState({
    ...repaired.state,
    schema_version: 14,
    purchaseLines: []
  });
  assert.equal(emptied.state.purchaseLines.length, 0);
});
