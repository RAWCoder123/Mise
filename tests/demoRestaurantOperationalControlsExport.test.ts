import assert from "node:assert/strict";
import test from "node:test";

import { DEMO_RESTAURANT_ID } from "../services/demo/replaceableDemoData";

async function demoRepository() {
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
  return repository;
}

test("demo restaurant export includes the hosted default-off kill-switch row", async () => {
  const repository = await demoRepository();
  const exported = await repository.exportRestaurantData(DEMO_RESTAURANT_ID);
  const controls = exported.datasets.restaurant_operational_controls;

  assert.equal(controls.length, 1, "every restaurant has exactly one controls row");
  assert.equal(exported.counts.restaurant_operational_controls, 1);

  const row = controls[0] as Record<string, unknown>;
  assert.equal(row.restaurant_id, DEMO_RESTAURANT_ID);
  assert.equal(row.square_sync_enabled, false);
  assert.equal(row.square_webhooks_enabled, false);
  assert.equal(row.gmail_delivery_enabled, false);
  assert.equal(row.insight_generation_enabled, false);
  assert.equal(row.order_drafting_enabled, false);
  assert.equal(row.stripe_invoicing_enabled, false);
  assert.equal(row.ordering_policy, "off");
  assert.equal(row.updated_by, null);
  assert.equal(typeof row.updated_at, "string");
  assert.ok(Number.isFinite(Date.parse(String(row.updated_at))), "updated_at must be ISO");
});
