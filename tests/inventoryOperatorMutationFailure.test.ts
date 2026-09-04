import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { translate } from "../i18n/catalog";
import {
  inventoryOperatorMutationFailureMessageKey,
  inventoryOperatorMutationFailureReasonFrom
} from "../services/domain/inventoryOperatorMutationFailures";

test("maps known inventory operator mutation failures to stable reasons", () => {
  assert.equal(
    inventoryOperatorMutationFailureReasonFrom(
      Object.assign(new Error("Not authorized for this restaurant"), { code: "42501" })
    ),
    "permission_denied"
  );
  assert.equal(
    inventoryOperatorMutationFailureReasonFrom(new TypeError("fetch failed")),
    "network"
  );
  assert.equal(
    inventoryOperatorMutationFailureReasonFrom(new Error("A stockout quantity must be zero.")),
    "stockout_quantity_nonzero"
  );
  assert.equal(
    inventoryOperatorMutationFailureReasonFrom(new Error("Enter a quantity greater than zero.")),
    "quantity_must_be_positive"
  );
  assert.equal(
    inventoryOperatorMutationFailureReasonFrom(new Error("Choose a supported inventory operation.")),
    "unsupported_operation"
  );
  assert.equal(
    inventoryOperatorMutationFailureReasonFrom(new Error("Choose grams, milliliters, or each.")),
    "invalid_canonical_unit"
  );
  assert.equal(
    inventoryOperatorMutationFailureReasonFrom(new Error("Enter a valid inventory time.")),
    "invalid_timestamp"
  );
  assert.equal(
    inventoryOperatorMutationFailureReasonFrom(new Error("Enter a valid inventory quantity.")),
    "invalid_quantity"
  );
  assert.equal(
    inventoryOperatorMutationFailureReasonFrom(new Error("Enter a shorter note.")),
    "note_too_long"
  );
  assert.equal(
    inventoryOperatorMutationFailureReasonFrom(new Error("Enter a valid inventory item.")),
    "invalid_identifier"
  );
  assert.equal(
    inventoryOperatorMutationFailureReasonFrom(new Error("unexpected postgres detail xyz")),
    "unknown"
  );
});

test("maps failure reasons to localized catalog keys without raw exception copy", () => {
  assert.equal(
    inventoryOperatorMutationFailureMessageKey("permission_denied"),
    "inventory.ops.failure.permissionDenied"
  );
  assert.equal(
    inventoryOperatorMutationFailureMessageKey("network"),
    "inventory.ops.failure.network"
  );
  assert.equal(
    inventoryOperatorMutationFailureMessageKey("invalid_quantity"),
    "inventory.ops.quantityInvalid"
  );
  assert.equal(
    inventoryOperatorMutationFailureMessageKey("unknown"),
    "inventory.ops.submitError"
  );

  const keys = [
    "inventory.ops.failure.permissionDenied",
    "inventory.ops.failure.network",
    "inventory.ops.failure.quantityPositive",
    "inventory.ops.failure.stockoutQuantity",
    "inventory.ops.failure.unsupportedOperation",
    "inventory.ops.failure.canonicalUnit",
    "inventory.ops.failure.timestamp",
    "inventory.ops.failure.invalidIdentifier",
    "inventory.ops.failure.noteTooLong",
    "inventory.ops.quantityInvalid",
    "inventory.ops.submitError"
  ] as const;

  const catalog = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");
  for (const key of keys) {
    assert.equal(catalog.split(`"${key}"`).length - 1, 3, `${key} must exist in en/es/zh-Hans`);
    assert.match(translate("en", key), /\S/);
    assert.match(translate("es", key), /\S/);
    assert.match(translate("zh-Hans", key), /\S/);
  }
});

test("inventory detail and log delivery never surface raw caught.message on submit", () => {
  const inventoryDetail = readFileSync(new URL("../app/inventory/[id].tsx", import.meta.url), "utf8");
  const logDelivery = readFileSync(new URL("../app/more/log-delivery.tsx", import.meta.url), "utf8");

  for (const [name, screen] of [
    ["inventory detail", inventoryDetail],
    ["log delivery", logDelivery]
  ] as const) {
    assert.match(screen, /inventoryOperatorMutationFailureReasonFrom/, `${name} needs reason mapper`);
    assert.match(screen, /inventoryOperatorMutationFailureMessageKey/, `${name} needs message key mapper`);
    assert.match(screen, /captureMiseError/, `${name} needs telemetry capture`);
    assert.doesNotMatch(
      screen,
      /submitError\.message\.slice\(0,\s*220\)/,
      `${name} must not slice raw exception text`
    );
  }

  assert.match(inventoryDetail, /flow:\s*"inventory_detail"/);
  assert.match(logDelivery, /flow:\s*"log_delivery"/);
});
