import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("receipt correct screen pins manager-only superseding correction submission", () => {
  const screen = readFileSync("app/more/receipt-correct.tsx", "utf8");
  assert.match(screen, /correctReceiptEvent/);
  assert.match(screen, /fetchCorrectableOperatorReceipts/);
  assert.match(screen, /canManageRestaurantData/);
  assert.match(screen, /resolveRestaurantScopedHubLoadState/);
  assert.match(screen, /presentRestaurantScopedHubActionsEditable/);
  assert.match(screen, /hubReady\s*\?\s*receipts\s*:\s*\[\]/);
  assert.match(screen, /receiptCorrect\.noteLabel/);
  assert.match(screen, /requestIdRef/);
  assert.match(screen, /activeRestaurantIdRef/);
  assert.doesNotMatch(screen, /source:\s*"supplier_delivery"/);
});

test("more hub and router expose receipt correction", () => {
  const more = readFileSync("app/(tabs)/more.tsx", "utf8");
  const layout = readFileSync("app/_layout.tsx", "utf8");
  const smoke = readFileSync("scripts/mobile-route-smoke.mjs", "utf8");
  const service = readFileSync("services/miseService.ts", "utf8");
  assert.match(more, /\/more\/receipt-correct/);
  assert.match(more, /more\.row\.receiptCorrect\.title/);
  assert.match(layout, /more\/receipt-correct/);
  assert.match(smoke, /\/more\/receipt-correct/);
  assert.match(service, /application\/receiptCorrection/);
});

test("generic inventory ops still cannot set supersedesEventId", () => {
  const validation = readFileSync("services/miseValidation.ts", "utf8");
  assert.match(validation, /export function requireReceiptCorrectionInput/);
  assert.match(
    validation,
    /function requireInventoryOperation[\s\S]*supersedesEventId:\s*null/
  );
});
