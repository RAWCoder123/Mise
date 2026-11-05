import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  INVENTORY_EVENT_REASON_MESSAGE_KEYS,
  inventoryEventReasonMessageKey
} from "../services/domain/inventoryEventTransport";

test("inventory detail localizes opaque ledger rejection reasons in queue evidence", () => {
  const source = readFileSync("app/inventory/[id].tsx", "utf8");
  assert.match(source, /inventoryEventReasonMessageKey/);
  assert.match(source, /formatInventoryQueueReason/);
  assert.match(source, /canonical_conversion_unverified/);
  assert.match(source, /future_dated_count/);
  assert.match(source, /future_dated_event/);
  assert.match(source, /inventory\.ops\.result\.canonicalConversionUnverified/);
  assert.match(source, /inventory\.ops\.result\.futureDated/);
  assert.match(source, /fetchQueuedInventoryEvents\(restaurantId\)/);
});

test("demo inventory projection rejects unverified conversion without outbox deferral throws", () => {
  const source = readFileSync("services/repositories/demoRepository.ts", "utf8");
  const start = source.indexOf("async function recordInventoryEvent");
  assert.ok(start >= 0);
  const method = source.slice(start, start + 2500);
  assert.match(method, /status:\s*"rejected"/);
  assert.match(method, /canonical_conversion_unverified/);
  assert.doesNotMatch(
    method,
    /throw new Error\("Inventory item canonical conversion is not verified"\)/
  );
});

test("inventory event rejection reason copy exists in EN, ES, and zh-Hans catalogs", () => {
  const catalog = readFileSync("i18n/catalog.ts", "utf8");
  const keys = [
    "inventory.ops.result.canonicalConversionUnverified",
    "inventory.ops.result.futureDated",
    ...Object.values(INVENTORY_EVENT_REASON_MESSAGE_KEYS)
  ];
  for (const key of keys) {
    const matches = catalog.match(new RegExp(`"${key.replace(/\./g, "\\.")}"`, "g"));
    assert.equal(matches?.length, 3, `${key} should appear once per locale`);
  }
});

test("inventory event reason message key map covers conversion and future-dated codes", () => {
  assert.equal(
    inventoryEventReasonMessageKey("canonical_conversion_unverified"),
    "inventory.ops.queue.reasonCode.canonical_conversion_unverified"
  );
  assert.equal(
    inventoryEventReasonMessageKey("future_dated_count"),
    "inventory.ops.queue.reasonCode.future_dated_count"
  );
  assert.equal(
    inventoryEventReasonMessageKey("future_dated_event"),
    "inventory.ops.queue.reasonCode.future_dated_event"
  );
  assert.equal(inventoryEventReasonMessageKey("not_a_real_reason"), null);
});
