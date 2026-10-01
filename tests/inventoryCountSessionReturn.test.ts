import assert from "node:assert/strict";
import test from "node:test";

import { DEMO_RESTAURANT_ID } from "../services/demoData";

test("demo count session return preserves lines and clears submit markers", async () => {
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
  await repository.resetDemoData(null);

  const inventory = await repository.fetchInventoryItems(DEMO_RESTAURANT_ID);
  assert.ok(inventory.length > 0);
  for (const item of inventory.slice(0, Math.min(inventory.length, 8))) {
    const unit = item.unit.toLowerCase();
    const conversion =
      unit === "lb" || unit === "lbs"
        ? 453.59237
        : unit === "oz"
          ? 28.349523125
          : unit === "kg"
            ? 1000
            : unit === "g"
              ? 1
              : unit === "ml"
                ? 1
                : unit === "l" || unit === "liter" || unit === "litre"
                  ? 1000
                  : unit === "each" || unit === "ea" || unit === "ct" || unit === "count"
                    ? 1
                    : null;
    if (!conversion) continue;
    const canonicalUnit =
      unit === "ml" || unit === "l" || unit === "liter" || unit === "litre" ? "ml" : unit === "each" || unit === "ea" || unit === "ct" || unit === "count" ? "each" : "g";
    await repository.verifyInventoryItemCanonicalUnit(
      DEMO_RESTAURANT_ID,
      item.id,
      canonicalUnit,
      conversion
    );
  }

  const started = await repository.beginInventoryCountSession(DEMO_RESTAURANT_ID, null);
  assert.equal(started.session.status, "in_progress");
  assert.ok(started.lines.length > 0);

  const lineUpdates = started.lines.map((line) => ({
    inventoryItemId: line.inventory_item_id,
    countedQuantity: Number(line.system_quantity_at_start),
    note: line.inventory_item_id === started.lines[0]?.inventory_item_id ? "Spot check note" : null
  }));
  const saved = await repository.saveInventoryCountLines(
    DEMO_RESTAURANT_ID,
    started.session.id,
    lineUpdates
  );
  const submitted = await repository.submitInventoryCountSession(
    DEMO_RESTAURANT_ID,
    saved.session.id
  );
  assert.equal(submitted.session.status, "submitted");
  assert.ok(submitted.session.submitted_at);
  assert.equal(
    submitted.lines.find((line) => line.note === "Spot check note")?.note,
    "Spot check note"
  );

  const returned = await repository.returnInventoryCountSession(
    DEMO_RESTAURANT_ID,
    submitted.session.id
  );
  assert.equal(returned.session.status, "in_progress");
  assert.equal(returned.session.submitted_at, null);
  assert.equal(returned.session.submitted_by, null);
  assert.equal(returned.lines.length, submitted.lines.length);
  assert.equal(
    returned.lines.find((line) => line.note === "Spot check note")?.counted_quantity,
    Number(started.lines[0]?.system_quantity_at_start)
  );

  await assert.rejects(
    () => repository.returnInventoryCountSession(DEMO_RESTAURANT_ID, returned.session.id),
    /submitted/i
  );

  const resubmitted = await repository.submitInventoryCountSession(
    DEMO_RESTAURANT_ID,
    returned.session.id
  );
  assert.equal(resubmitted.session.status, "submitted");
});
