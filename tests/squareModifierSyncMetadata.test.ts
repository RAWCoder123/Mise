import assert from "node:assert/strict";
import test from "node:test";

test("demo Square sync returns bounded modifier pressure without inventing sale rows", async () => {
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

  const { createLocalDemoRepository } = await import("../services/repositories/demoRepository");
  const repository = createLocalDemoRepository();
  const restaurant = await repository.resetDemoData("Square");
  const result = await repository.syncSquarePosSales(
    restaurant.id,
    "2026-08-01",
    "2026-08-28"
  );
  assert.equal(result.status, "completed");
  assert.ok(result.recordsProcessed > 0);
  assert.equal(result.catalogProcessed, 0);
  assert.ok(result.modifiersUniqueCount >= 1);
  assert.ok(result.modifiersObservedCount >= 1);
  assert.equal(result.modifiersSample[0]?.id, "demo-mod-extra-cheese");
  assert.equal(result.modifiersSample[0]?.name, "Extra Cheese");

  const latest = await repository.fetchLatestSquareModifierSyncSummary(restaurant.id);
  assert.ok(latest);
  assert.equal(latest?.modifiersSample[0]?.id, "demo-mod-extra-cheese");
});
