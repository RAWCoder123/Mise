import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildInventoryCountLinePayload,
  presentInventoryCountFailureCopy,
  presentInventoryCountMutationActionsEditable,
  presentInventoryCountStartCopy,
  presentInventoryCountSuccessCopy,
  resolveInventoryCountFailureReason,
  resolveInventoryCountLoadState
} from "../services/presentation/inventoryCountPresentation";
import {
  presentInventoryDetailMissingCopy,
  resolveInventoryDetailLoadState
} from "../services/presentation/inventoryDetailPresentation";

const countScreen = readFileSync("app/inventory/count.tsx", "utf8");
const catalog = readFileSync("i18n/catalog.ts", "utf8");

test("inventory count load state fails closed after soft-refresh failure even with prior restaurant data", () => {
  assert.equal(
    resolveInventoryCountLoadState({
      restaurantId: "rest_a",
      loadedRestaurantId: "rest_a",
      loadError: true
    }),
    "error"
  );
  assert.equal(
    resolveInventoryCountLoadState({
      restaurantId: "rest_a",
      loadedRestaurantId: null,
      loadError: true
    }),
    "error"
  );
  assert.equal(
    resolveInventoryCountLoadState({
      restaurantId: "rest_a",
      loadedRestaurantId: null,
      loadError: false
    }),
    "loading"
  );
});

test("inventory count start copy never offers a new session while loading or unavailable", () => {
  const copy = {
    loadingTitle: "Loading",
    loadingBody: "Checking",
    unavailableTitle: "Unavailable",
    unavailableBody: "Retry",
    startTitle: "Start",
    startBody: "Begin"
  };

  assert.deepEqual(presentInventoryCountStartCopy("loading", copy), {
    title: "Loading",
    body: "Checking",
    canStart: false
  });
  assert.deepEqual(presentInventoryCountStartCopy("error", copy), {
    title: "Unavailable",
    body: "Retry",
    canStart: false
  });
  assert.deepEqual(presentInventoryCountStartCopy("ready", copy), {
    title: "Start",
    body: "Begin",
    canStart: true
  });
});

test("inventory count mutation actions stay locked while busy or hub not ready", () => {
  assert.equal(presentInventoryCountMutationActionsEditable(true, false, true), true);
  assert.equal(presentInventoryCountMutationActionsEditable(true, true, true), false);
  assert.equal(presentInventoryCountMutationActionsEditable(false, false, true), false);
  assert.equal(presentInventoryCountMutationActionsEditable(true, false, false), false);
});

test("inventory detail load state and missing copy distinguish loading, error, and not found", () => {
  assert.equal(
    resolveInventoryDetailLoadState({
      restaurantId: "rest_a",
      loadedRestaurantId: "rest_a",
      loadError: true
    }),
    "error"
  );
  assert.equal(
    resolveInventoryDetailLoadState({
      restaurantId: "rest_a",
      loadedRestaurantId: null,
      loadError: true
    }),
    "error"
  );

  const copy = {
    loading: "Loading item",
    unavailable: "Unavailable item",
    notFound: "Missing item"
  };
  assert.equal(presentInventoryDetailMissingCopy("loading", copy), "Loading item");
  assert.equal(presentInventoryDetailMissingCopy("error", copy), "Unavailable item");
  assert.equal(presentInventoryDetailMissingCopy("ready", copy), "Missing item");
});

test("inventory count failure reasons map backend English errors without leaking raw messages", () => {
  assert.equal(
    resolveInventoryCountFailureReason(
      new Error("A count session is already open for this restaurant")
    ),
    "alreadyOpen"
  );
  assert.equal(
    resolveInventoryCountFailureReason(
      new Error("Add inventory items before starting a count session")
    ),
    "noItems"
  );
  assert.equal(
    resolveInventoryCountFailureReason(new Error("Count sessions support at most 250 items")),
    "capacity"
  );
  assert.equal(
    resolveInventoryCountFailureReason(
      new Error("Only an in-progress count session can be edited")
    ),
    "notInProgress"
  );
  assert.equal(
    resolveInventoryCountFailureReason(
      new Error("Submit the count session before approving adjustments.")
    ),
    "notSubmitted"
  );
  assert.equal(
    resolveInventoryCountFailureReason(new Error("This count session is already closed.")),
    "alreadyClosed"
  );
  assert.equal(
    resolveInventoryCountFailureReason(new Error("Count session not found")),
    "notFound"
  );
  assert.equal(
    resolveInventoryCountFailureReason(
      new Error("Count every item before submitting the session")
    ),
    "incomplete"
  );
  assert.equal(
    resolveInventoryCountFailureReason(
      new Error("Count lines payload size is outside supported limits")
    ),
    "invalidLines"
  );
  assert.equal(
    resolveInventoryCountFailureReason(
      new Error("One or more count lines are not part of this session")
    ),
    "unknownLine"
  );
  assert.equal(
    resolveInventoryCountFailureReason(
      new Error("Counted quantity is outside supported limits")
    ),
    "quantityBounds"
  );
  assert.equal(
    resolveInventoryCountFailureReason(
      new Error("Count line note is limited to 240 characters.")
    ),
    "noteBounds"
  );
  assert.equal(
    resolveInventoryCountFailureReason(new Error("Not authorized for this restaurant")),
    "permission"
  );
  assert.equal(resolveInventoryCountFailureReason(new Error("network down")), "unknown");
  assert.equal(resolveInventoryCountFailureReason("not-an-error"), "unknown");
});

test("inventory count failure and success copy keep intentional tones", () => {
  const failure = presentInventoryCountFailureCopy("alreadyOpen", {
    alreadyOpen: { title: "Open", message: "Finish first" },
    noItems: { title: "No items", message: "Add items" },
    capacity: { title: "Full", message: "Too many" },
    notInProgress: { title: "Locked", message: "Not editable" },
    notSubmitted: { title: "Submit", message: "Submit first" },
    alreadyClosed: { title: "Closed", message: "Done" },
    notFound: { title: "Missing", message: "Refresh" },
    invalidLines: { title: "Lines", message: "Bad payload" },
    unknownLine: { title: "Mismatch", message: "Wrong lines" },
    quantityBounds: { title: "Qty", message: "Bad qty" },
    noteBounds: { title: "Note", message: "Too long" },
    incomplete: { title: "Incomplete", message: "Finish all" },
    saveEmpty: { title: "Empty", message: "Enter one" },
    invalidQuantity: { title: "Invalid", message: "Check item" },
    permission: { title: "Denied", message: "No access" },
    unknown: { title: "Failed", message: "Try again" }
  });
  assert.equal(failure.tone, "danger");
  assert.equal(failure.title, "Open");
  assert.equal(failure.message, "Finish first");

  const success = presentInventoryCountSuccessCopy("submit", {
    start: "Started",
    save: "Saved",
    submit: "Submitted",
    approve: "Approved",
    cancel: "Cancelled"
  });
  assert.equal(success.tone, "success");
  assert.equal(success.title, "Submitted");
});

test("inventory count line payload builder returns structured client validation reasons", () => {
  const lines = [
    { inventory_item_id: "item_1", item_name: "Tomato" },
    { inventory_item_id: "item_2", item_name: "Onion" }
  ];

  assert.deepEqual(
    buildInventoryCountLinePayload({
      lines,
      draftCounts: {},
      draftNotes: {},
      parseNumber: (value) => Number(value),
      requireComplete: false
    }),
    { ok: false, reason: "saveEmpty" }
  );

  assert.deepEqual(
    buildInventoryCountLinePayload({
      lines,
      draftCounts: { item_1: "2", item_2: "" },
      draftNotes: {},
      parseNumber: (value) => Number(value),
      requireComplete: true
    }),
    { ok: false, reason: "incomplete" }
  );

  assert.deepEqual(
    buildInventoryCountLinePayload({
      lines,
      draftCounts: { item_1: "abc" },
      draftNotes: {},
      parseNumber: () => null,
      requireComplete: false
    }),
    { ok: false, reason: "invalidQuantity", item: "Tomato" }
  );

  assert.deepEqual(
    buildInventoryCountLinePayload({
      lines,
      draftCounts: { item_1: "2" },
      draftNotes: { item_1: "x".repeat(241) },
      parseNumber: (value) => Number(value),
      requireComplete: false
    }),
    { ok: false, reason: "noteTooLong" }
  );

  assert.deepEqual(
    buildInventoryCountLinePayload({
      lines,
      draftCounts: { item_1: "2", item_2: "3" },
      draftNotes: { item_1: "shrink", item_2: "" },
      parseNumber: (value) => Number(value),
      requireComplete: true
    }),
    {
      ok: true,
      lines: [
        { inventoryItemId: "item_1", countedQuantity: 2, note: "shrink" },
        { inventoryItemId: "item_2", countedQuantity: 3, note: null }
      ]
    }
  );
});

test("inventory count screen uses localized StatusNotice and never renders raw error.message", () => {
  assert.match(countScreen, /resolveInventoryCountFailureReason/);
  assert.match(countScreen, /presentInventoryCountFailureCopy/);
  assert.match(countScreen, /buildInventoryCountLinePayload/);
  assert.match(countScreen, /StatusNotice/);
  assert.match(countScreen, /captureMiseError/);
  assert.match(countScreen, /activeRestaurantIdRef/);
  assert.doesNotMatch(countScreen, /caught\.message/);
  assert.doesNotMatch(countScreen, /error\.message/);
  assert.match(catalog, /inventory\.count\.notice\.alreadyOpenTitle/);
  assert.match(catalog, /inventory\.count\.notice\.permissionBody/);
  assert.match(catalog, /"inventory\.count\.notice\.actionTitle":\s*"La acción de conteo necesita atención"/);
  assert.match(catalog, /"inventory\.count\.notice\.actionTitle":\s*"盘点操作需要处理"/);
});

test("inventory count screen wires hub-ready mutation editability for deep-link mutations", () => {
  assert.match(countScreen, /presentInventoryCountMutationActionsEditable/);
  assert.match(
    countScreen,
    /presentInventoryCountMutationActionsEditable\(\s*canDraft,\s*saving,\s*hubReady\s*\)/
  );
  assert.match(
    countScreen,
    /presentInventoryCountMutationActionsEditable\(\s*canApprove,\s*saving,\s*hubReady\s*\)/
  );
  assert.match(countScreen, /disabled=\{!draftEditable\}/);
  assert.match(countScreen, /disabled=\{!approveEditable\}/);
  assert.match(countScreen, /draftEditable && visibleDetail\.session\.status === "in_progress"/);
  assert.match(countScreen, /!draftEditable\) return/);
  assert.match(countScreen, /!approveEditable\) return/);
});
