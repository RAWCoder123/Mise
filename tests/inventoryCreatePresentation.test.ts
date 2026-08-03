import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  presentInventoryCreateFailureCopy,
  presentInventoryCreateFormEditable,
  resolveInventoryCreateAccessState,
  resolveInventoryCreateFailureReason
} from "../services/presentation/inventoryCreatePresentation";

const createScreen = readFileSync("app/inventory/new.tsx", "utf8");
const setupScreen = readFileSync("app/(auth)/setup.tsx", "utf8");
const catalog = readFileSync("i18n/catalog.ts", "utf8");

test("inventory create access state waits for session readiness before claiming missing workspace", () => {
  assert.equal(
    resolveInventoryCreateAccessState({
      sessionReady: false,
      restaurantId: null,
      canManage: false
    }),
    "loading"
  );
  assert.equal(
    resolveInventoryCreateAccessState({
      sessionReady: true,
      restaurantId: null,
      canManage: false
    }),
    "missing"
  );
  assert.equal(
    resolveInventoryCreateAccessState({
      sessionReady: true,
      restaurantId: "rest_1",
      canManage: false
    }),
    "readonly"
  );
  assert.equal(
    resolveInventoryCreateAccessState({
      sessionReady: true,
      restaurantId: "rest_1",
      canManage: true
    }),
    "ready"
  );
});

test("inventory create form stays non-editable while saving or when access is not ready", () => {
  assert.equal(presentInventoryCreateFormEditable("loading", false), false);
  assert.equal(presentInventoryCreateFormEditable("missing", false), false);
  assert.equal(presentInventoryCreateFormEditable("readonly", false), false);
  assert.equal(presentInventoryCreateFormEditable("ready", true), false);
  assert.equal(presentInventoryCreateFormEditable("ready", false), true);
});

test("inventory create failure reasons map backend English errors to localized notice keys", () => {
  assert.equal(
    resolveInventoryCreateFailureReason(new Error('An inventory item named "Tomato" already exists.')),
    "duplicate"
  );
  assert.equal(
    resolveInventoryCreateFailureReason(
      new Error("This restaurant already has the maximum of 250 inventory items.")
    ),
    "capacity"
  );
  assert.equal(
    resolveInventoryCreateFailureReason(new Error("Item name must be between 1 and 160 characters.")),
    "itemName"
  );
  assert.equal(
    resolveInventoryCreateFailureReason(new Error("Category must be between 1 and 120 characters.")),
    "category"
  );
  assert.equal(
    resolveInventoryCreateFailureReason(new Error("Unit must be between 1 and 40 characters.")),
    "unit"
  );
  assert.equal(
    resolveInventoryCreateFailureReason(new Error("Supplier name must be between 1 and 160 characters.")),
    "supplier"
  );
  assert.equal(
    resolveInventoryCreateFailureReason(
      new Error("Current quantity must be between 0 and 1,000,000.")
    ),
    "quantity"
  );
  assert.equal(
    resolveInventoryCreateFailureReason(new Error("Inventory item details are required.")),
    "validation"
  );
  assert.equal(resolveInventoryCreateFailureReason(new Error("network down")), "unknown");
  assert.equal(resolveInventoryCreateFailureReason("not-an-error"), "unknown");
});

test("inventory create failure copy never invents success tone", () => {
  const notice = presentInventoryCreateFailureCopy("duplicate", {
    validation: { title: "Missing", message: "Fill fields" },
    duplicate: { title: "Exists", message: "Pick another name" },
    capacity: { title: "Full", message: "Max items" },
    itemName: { title: "Name", message: "Bad name" },
    category: { title: "Category", message: "Bad category" },
    unit: { title: "Unit", message: "Bad unit" },
    supplier: { title: "Supplier", message: "Bad supplier" },
    quantity: { title: "Qty", message: "Bad qty" },
    unknown: { title: "Failed", message: "Could not save" }
  });
  assert.equal(notice.tone, "danger");
  assert.equal(notice.title, "Exists");
  assert.equal(notice.message, "Pick another name");
});

test("inventory create screen uses localized StatusNotice and never renders raw error.message", () => {
  assert.match(createScreen, /resolveInventoryCreateAccessState/);
  assert.match(createScreen, /resolveInventoryCreateFailureReason/);
  assert.match(createScreen, /presentInventoryCreateFailureCopy/);
  assert.match(createScreen, /StatusNotice/);
  assert.match(createScreen, /captureMiseError/);
  assert.match(createScreen, /activeRestaurantIdRef/);
  assert.doesNotMatch(
    createScreen,
    /setMessage\(error\s+instanceof\s+Error\s*\?\s*error\.message/
  );
  assert.doesNotMatch(createScreen, /error\.message\s*:\s*t\(/);
  assert.match(catalog, /inventory\.create\.notice\.duplicateTitle/);
  assert.match(catalog, /inventory\.create\.notice\.capacityBody/);
  assert.match(catalog, /inventory\.create\.noWorkspaceTitle/);
  assert.match(catalog, /"inventory\.create\.status\.loading":\s*"Cargando permisos del restaurante…"/);
  assert.match(catalog, /"inventory\.create\.notice\.saveTitle":\s*"无法创建项目"/);
});

test("setup surfaces localized StatusNotice for step and create failures", () => {
  assert.match(setupScreen, /setup\.error\.noticeTitle/);
  assert.match(setupScreen, /StatusNotice/);
  assert.match(setupScreen, /tone="danger"/);
  assert.match(catalog, /"setup\.error\.noticeTitle":\s*"Setup needs attention"/);
  assert.match(catalog, /"setup\.error\.noticeTitle":\s*"La configuración necesita atención"/);
  assert.match(catalog, /"setup\.error\.noticeTitle":\s*"设置需要处理"/);
});
