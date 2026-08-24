import assert from "node:assert/strict";
import test from "node:test";

import { isSupplierSendVerificationRace } from "../services/domain/supplierSendErrors";

test("supplier send verification races are identified only by PostgreSQL serialization code", () => {
  assert.equal(isSupplierSendVerificationRace({ code: "40001", message: "internal detail" }), true);
  assert.equal(isSupplierSendVerificationRace({ code: "42501" }), false);
  assert.equal(isSupplierSendVerificationRace(new Error("40001")), false);
});
