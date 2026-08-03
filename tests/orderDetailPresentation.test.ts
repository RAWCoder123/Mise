import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  presentOrderDetailMissingCopy,
  resolveOrderDetailLoadState
} from "../services/presentation/orderDetailPresentation";

const orderDetail = readFileSync("app/orders/[id].tsx", "utf8");

test("order detail load state stays ready after soft-refresh failure with prior restaurant data", () => {
  assert.equal(
    resolveOrderDetailLoadState({
      restaurantId: "rest_a",
      loadedRestaurantId: "rest_a",
      loadError: true
    }),
    "ready"
  );
  assert.equal(
    resolveOrderDetailLoadState({
      restaurantId: "rest_a",
      loadedRestaurantId: null,
      loadError: true
    }),
    "error"
  );
  assert.equal(
    resolveOrderDetailLoadState({
      restaurantId: "rest_a",
      loadedRestaurantId: null,
      loadError: false
    }),
    "loading"
  );
});

test("order detail missing copy distinguishes loading, error, and not found", () => {
  const copy = {
    loading: "Loading order",
    unavailable: "Unavailable order",
    notFound: "Missing order"
  };
  assert.equal(presentOrderDetailMissingCopy("loading", copy), "Loading order");
  assert.equal(presentOrderDetailMissingCopy("error", copy), "Unavailable order");
  assert.equal(presentOrderDetailMissingCopy("ready", copy), "Missing order");
});

test("order detail wires soft-refresh and RetryNotice instead of false empty draft", () => {
  assert.match(orderDetail, /resolveOrderDetailLoadState/);
  assert.match(orderDetail, /presentOrderDetailMissingCopy/);
  assert.match(orderDetail, /RetryNotice/);
  assert.match(orderDetail, /orders\.detail\.retry\.title/);
  assert.match(orderDetail, /orders\.detail\.retry\.accessibility/);
  assert.match(orderDetail, /onRetry=\{\(\) => void load\(true\)\}/);
  assert.match(orderDetail, /loadedRestaurantRef/);
  assert.match(orderDetail, /loadedOrderIdRef/);
  assert.match(orderDetail, /hubReady\s*\?\s*order\s*:\s*null/);
  assert.match(orderDetail, /keepPrior/);
  assert.match(orderDetail, /orders\.detail\.loading/);
  assert.match(orderDetail, /orders\.detail\.unavailable/);
});
