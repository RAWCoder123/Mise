import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const orderDetail = readFileSync(new URL("../app/orders/[id].tsx", import.meta.url), "utf8");
const deliveries = readFileSync(
  new URL("../services/application/deliveries.ts", import.meta.url),
  "utf8"
);
const catalog = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");

describe("receive-line substitution UI pins", () => {
  it("wires preview and substitutions through receive on order detail", () => {
    assert.match(orderDetail, /previewSupplierOrderDelivery/);
    assert.match(orderDetail, /substitutionsByOrderedItemId/);
    assert.match(orderDetail, /orders\.detail\.receive\.title/);
    assert.match(orderDetail, /orders\.detail\.receive\.asOrdered/);
  });

  it("application receive accepts substitution overrides", () => {
    assert.match(deliveries, /substitutionsByOrderedItemId/);
    assert.match(deliveries, /applyDeliveryLineSubstitutions/);
    assert.match(deliveries, /previewSupplierOrderDelivery/);
  });

  it("localizes receive substitution copy in EN, ES, and zh-Hans", () => {
    for (const key of [
      "orders.detail.receive.title",
      "orders.detail.receive.body",
      "orders.detail.receive.asOrdered",
      "orders.detail.receive.substitutionNoticeBody"
    ]) {
      const matches = catalog.match(new RegExp(`"${key.replace(/\./g, "\\.")}"`, "g")) ?? [];
      assert.equal(matches.length, 3, `${key} should appear once per locale`);
    }
  });
});
