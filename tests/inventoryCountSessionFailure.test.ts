import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  InventoryCountSessionClientError,
  inventoryCountSessionFailureMessageKey,
  inventoryCountSessionFailureReasonFrom
} from "../services/domain/inventoryCountSessions";
import { translate } from "../i18n/catalog";

test("maps known count-session RPC and demo failures to stable reasons", () => {
  assert.equal(
    inventoryCountSessionFailureReasonFrom(
      new Error("Verify canonical units for inventory items before starting a count session")
    ),
    "unverified_canonical_units"
  );
  assert.equal(
    inventoryCountSessionFailureReasonFrom(
      new Error("Count sessions support at most 250 items")
    ),
    "item_cap_exceeded"
  );
  assert.equal(
    inventoryCountSessionFailureReasonFrom(
      Object.assign(new Error("A count session is already open for this restaurant"), {
        code: "23505"
      })
    ),
    "already_open"
  );
  assert.equal(
    inventoryCountSessionFailureReasonFrom(
      Object.assign(new Error("Not authorized for this restaurant"), { code: "42501" })
    ),
    "permission_denied"
  );
  assert.equal(
    inventoryCountSessionFailureReasonFrom(
      Object.assign(new Error("Planning snapshot changed; retry from a fresh snapshot"), {
        code: "40001"
      })
    ),
    "planning_conflict"
  );
  assert.equal(
    inventoryCountSessionFailureReasonFrom(new Error("Count every item before submitting the session")),
    "incomplete_lines"
  );
  assert.equal(
    inventoryCountSessionFailureReasonFrom(new Error("This count session is already closed")),
    "already_closed"
  );
  assert.equal(
    inventoryCountSessionFailureReasonFrom(
      new InventoryCountSessionClientError("note_outside_limits")
    ),
    "note_outside_limits"
  );
});

test("maps failure reasons to localized catalog keys without raw Postgres copy", () => {
  assert.equal(
    inventoryCountSessionFailureMessageKey("item_cap_exceeded", "start"),
    "inventory.count.failure.itemCap"
  );
  assert.equal(
    inventoryCountSessionFailureMessageKey("unverified_canonical_units", "start"),
    "inventory.count.startError"
  );
  assert.equal(
    inventoryCountSessionFailureMessageKey("unknown", "start"),
    "inventory.count.startErrorGeneric"
  );
  assert.equal(
    inventoryCountSessionFailureMessageKey("unknown", "save"),
    "inventory.count.saveError"
  );
  assert.equal(
    inventoryCountSessionFailureMessageKey("incomplete_lines", "submit"),
    "inventory.count.incomplete"
  );

  const keys = [
    "inventory.count.startErrorGeneric",
    "inventory.count.failure.itemCap",
    "inventory.count.failure.alreadyOpen",
    "inventory.count.failure.sessionNotFound",
    "inventory.count.failure.notEditable",
    "inventory.count.failure.alreadyClosed",
    "inventory.count.failure.submitRequired",
    "inventory.count.failure.planningConflict",
    "inventory.count.failure.permissionDenied",
    "inventory.count.failure.quantityLimits",
    "inventory.count.failure.lineMissing",
    "inventory.count.failure.itemUnavailable",
    "inventory.count.failure.linesInvalid"
  ] as const;

  const catalog = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");
  for (const key of keys) {
    assert.equal(catalog.split(`"${key}"`).length - 1, 3, `${key} must exist in en/es/zh-Hans`);
    assert.match(translate("en", key), /\S/);
    assert.match(translate("es", key), /\S/);
    assert.match(translate("zh-Hans", key), /\S/);
  }
});

test("count UI never surfaces raw caught.message for session mutations", () => {
  const screen = readFileSync(new URL("../app/inventory/count.tsx", import.meta.url), "utf8");
  assert.match(screen, /inventoryCountSessionFailureReasonFrom/);
  assert.match(screen, /inventoryCountSessionFailureMessageKey/);
  assert.match(screen, /InventoryCountSessionClientError/);
  assert.match(screen, /presentCountSessionFailure\(caught, "start"\)/);
  assert.match(screen, /presentCountSessionFailure\(caught, "save"\)/);
  assert.match(screen, /presentCountSessionFailure\(caught, "submit"\)/);
  assert.match(screen, /presentCountSessionFailure\(caught, "approve"\)/);
  assert.match(screen, /presentCountSessionFailure\(caught, "cancel"\)/);
  assert.doesNotMatch(screen, /setError\(caught instanceof Error \? caught\.message/);
});
