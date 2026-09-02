import assert from "node:assert/strict";
import { test } from "node:test";

import { requireInventoryCountSessionItemIds } from "../services/miseValidation";

test("requireInventoryCountSessionItemIds treats null as a full count sheet", () => {
  assert.equal(requireInventoryCountSessionItemIds(null), null);
  assert.equal(requireInventoryCountSessionItemIds(undefined), null);
});

test("requireInventoryCountSessionItemIds accepts unique scoped item ids", () => {
  assert.deepEqual(
    requireInventoryCountSessionItemIds([
      "00000000-0000-4000-8000-000000000101",
      " 00000000-0000-4000-8000-000000000102 "
    ]),
    ["00000000-0000-4000-8000-000000000101", "00000000-0000-4000-8000-000000000102"]
  );
});

test("requireInventoryCountSessionItemIds rejects empty, oversized, and duplicate scopes", () => {
  assert.throws(() => requireInventoryCountSessionItemIds([]), /1 and 250/i);
  assert.throws(() => requireInventoryCountSessionItemIds(["a", "a"]), /unique/i);
  assert.throws(() => requireInventoryCountSessionItemIds("not-an-array"), /array/i);
  assert.throws(
    () => requireInventoryCountSessionItemIds(Array.from({ length: 251 }, (_, index) => `item_${index}`)),
    /1 and 250/i
  );
});
