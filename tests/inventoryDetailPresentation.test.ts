import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  isInventoryDetailStationActionBlocked,
  presentInventoryDetailMissingCopy,
  presentInventoryDetailMutationActionsEditable,
  presentInventoryDetailMutationBusy,
  presentInventoryDetailMutationNoticeCopy,
  presentInventoryDetailSecondaryLoadCopy,
  resolveInventoryDetailLoadState,
  resolveInventoryDetailSaveFailureReason,
  resolveInventoryDetailSecondaryLoadState,
  resolveInventoryDetailTransferFailureReason,
  resolveInventoryDetailWasteFailureReason,
  type InventoryDetailMutationNoticeReason
} from "../services/presentation/inventoryDetailPresentation";

const detailScreen = readFileSync("app/inventory/[id].tsx", "utf8");
const catalog = readFileSync("i18n/catalog.ts", "utf8");

const NOTICE_COPY: Record<InventoryDetailMutationNoticeReason, { title: string; message: string }> = {
  noWorkspace: { title: "Workspace required", message: "Open a restaurant" },
  viewOnlyInventory: { title: "View-only inventory", message: "Managers update counts" },
  viewOnlyOrdering: { title: "View-only ordering", message: "Managers order" },
  reviewFields: { title: "Check count fields", message: "Review highlighted fields" },
  updated: { title: "Inventory updated", message: "Logged as manager correction" },
  saveFailed: { title: "Could not save", message: "Retry save" },
  added: { title: "Added to orders", message: "Remembered ordering decision" },
  addFailed: { title: "Could not add", message: "Retry add" },
  reviewWaste: { title: "Check waste fields", message: "Review waste fields" },
  wasteRecorded: { title: "Waste recorded", message: "Stock updated" },
  wasteNothingOnHand: { title: "Nothing on hand", message: "Update the count first" },
  wasteLocationMissing: { title: "Add a location", message: "Create a storage location" },
  wasteLocationInsufficient: { title: "Not enough at station", message: "Choose another station" },
  wasteFailed: { title: "Could not record waste", message: "Retry waste" },
  reviewTransfer: { title: "Check transfer fields", message: "Review transfer fields" },
  transferRecorded: { title: "Transfer recorded", message: "Moved between locations" },
  transferInsufficient: { title: "Not enough at source", message: "Lower the transfer amount" },
  transferSameLocation: { title: "Choose different locations", message: "Need two locations" },
  transferLocationMissing: { title: "Add a location", message: "Create a storage location" },
  transferFailed: { title: "Could not transfer", message: "Retry transfer" },
  locationAdded: { title: "Location added", message: "Storage location added" },
  locationFailed: { title: "Could not add location", message: "Retry location" },
  locationsUnavailable: {
    title: "Stations unavailable",
    message: "Reload storage stations before waste or transfer."
  },
  loadFailed: { title: "Could not load item", message: "Retry load" }
};

test("inventory detail load state stays loading until the active restaurant item finishes", () => {
  assert.equal(
    resolveInventoryDetailLoadState({
      restaurantId: "r1",
      loadedRestaurantId: null,
      loadError: false
    }),
    "loading"
  );
  assert.equal(
    resolveInventoryDetailLoadState({
      restaurantId: "r1",
      loadedRestaurantId: "r1",
      loadError: false
    }),
    "ready"
  );
  assert.equal(
    resolveInventoryDetailLoadState({
      restaurantId: "r1",
      loadedRestaurantId: null,
      loadError: true
    }),
    "error"
  );
  assert.equal(
    resolveInventoryDetailLoadState({
      restaurantId: null,
      loadedRestaurantId: null,
      loadError: false
    }),
    "ready"
  );
});

test("inventory detail missing copy never claims not-found while loading or failed", () => {
  const copy = {
    loading: "Loading item",
    unavailable: "Unavailable item",
    notFound: "Missing item"
  };
  assert.equal(presentInventoryDetailMissingCopy("loading", copy), "Loading item");
  assert.equal(presentInventoryDetailMissingCopy("error", copy), "Unavailable item");
  assert.equal(presentInventoryDetailMissingCopy("ready", copy), "Missing item");
});

test("inventory detail mutation actions stay locked while busy or not ready", () => {
  assert.equal(presentInventoryDetailMutationBusy(true), true);
  assert.equal(presentInventoryDetailMutationActionsEditable(true, true, true), false);
  assert.equal(presentInventoryDetailMutationActionsEditable(true, false, false), false);
  assert.equal(presentInventoryDetailMutationActionsEditable(false, false, true), false);
  assert.equal(presentInventoryDetailMutationActionsEditable(true, false, true), true);
});

test("inventory detail screen wires hub-ready mutation editability for deep-link mutations", () => {
  assert.match(detailScreen, /presentInventoryDetailMutationActionsEditable/);
  assert.match(detailScreen, /presentInventoryDetailMutationBusy/);
  assert.match(
    detailScreen,
    /presentInventoryDetailMutationActionsEditable\(\s*canManage,\s*mutationBusy,\s*hubReady\s*\)/
  );
  assert.match(
    detailScreen,
    /presentInventoryDetailMutationActionsEditable\(\s*canRecordWaste,\s*mutationBusy,\s*hubReady\s*\)/
  );
  assert.match(
    detailScreen,
    /presentInventoryDetailMutationActionsEditable\(\s*canTransfer,\s*mutationBusy,\s*hubReady\s*\)/
  );
  assert.match(detailScreen, /editable=\{manageEditable\}/);
  assert.match(detailScreen, /editable=\{wasteEditable\}/);
  assert.match(detailScreen, /editable=\{transferEditable\}/);
  assert.match(detailScreen, /disabled=\{!manageEditable\}/);
  assert.match(detailScreen, /!hubReady \|\| mutationBusy\) return/);
});

test("inventory detail waste failure reasons map backend English errors without surfacing them", () => {
  assert.equal(
    resolveInventoryDetailWasteFailureReason(
      new Error("Insufficient quantity at the selected storage location.")
    ),
    "wasteLocationInsufficient"
  );
  assert.equal(
    resolveInventoryDetailWasteFailureReason(
      new Error("Nothing on hand to record as waste. Update the count first.")
    ),
    "wasteNothingOnHand"
  );
  assert.equal(
    resolveInventoryDetailWasteFailureReason(
      new Error("Create a storage location before recording waste.")
    ),
    "wasteLocationMissing"
  );
  assert.equal(resolveInventoryDetailWasteFailureReason(new Error("network down")), "wasteFailed");
  assert.equal(resolveInventoryDetailWasteFailureReason("not-an-error"), "wasteFailed");
});

test("inventory detail transfer failure reasons map backend English errors without surfacing them", () => {
  assert.equal(
    resolveInventoryDetailTransferFailureReason(
      new Error("Insufficient quantity at the source storage location.")
    ),
    "transferInsufficient"
  );
  assert.equal(
    resolveInventoryDetailTransferFailureReason(
      new Error("Choose different storage locations for a transfer.")
    ),
    "transferSameLocation"
  );
  assert.equal(
    resolveInventoryDetailTransferFailureReason(
      new Error("Create a storage location before transferring stock.")
    ),
    "transferLocationMissing"
  );
  assert.equal(
    resolveInventoryDetailTransferFailureReason(new Error("network down")),
    "transferFailed"
  );
});

test("inventory detail save failure reason stays fail-closed", () => {
  assert.equal(
    resolveInventoryDetailSaveFailureReason(new Error("Inventory item not found")),
    "saveFailed"
  );
  assert.equal(resolveInventoryDetailSaveFailureReason(new Error("")), "saveFailed");
  assert.equal(resolveInventoryDetailSaveFailureReason("x"), "saveFailed");
});

test("inventory detail mutation notice copy uses success, caution, neutral, and danger tones", () => {
  assert.equal(presentInventoryDetailMutationNoticeCopy("updated", NOTICE_COPY).tone, "success");
  assert.equal(presentInventoryDetailMutationNoticeCopy("wasteRecorded", NOTICE_COPY).tone, "success");
  assert.equal(presentInventoryDetailMutationNoticeCopy("transferRecorded", NOTICE_COPY).tone, "success");
  assert.equal(presentInventoryDetailMutationNoticeCopy("locationAdded", NOTICE_COPY).tone, "success");
  assert.equal(presentInventoryDetailMutationNoticeCopy("added", NOTICE_COPY).tone, "success");
  assert.equal(
    presentInventoryDetailMutationNoticeCopy("viewOnlyInventory", NOTICE_COPY).tone,
    "neutral"
  );
  assert.equal(presentInventoryDetailMutationNoticeCopy("reviewWaste", NOTICE_COPY).tone, "caution");
  assert.equal(
    presentInventoryDetailMutationNoticeCopy("wasteLocationInsufficient", NOTICE_COPY).tone,
    "caution"
  );
  assert.equal(
    presentInventoryDetailMutationNoticeCopy("transferInsufficient", NOTICE_COPY).tone,
    "caution"
  );
  assert.equal(presentInventoryDetailMutationNoticeCopy("saveFailed", NOTICE_COPY).tone, "danger");
  assert.equal(presentInventoryDetailMutationNoticeCopy("wasteFailed", NOTICE_COPY).tone, "danger");
  assert.equal(presentInventoryDetailMutationNoticeCopy("loadFailed", NOTICE_COPY).tone, "danger");
  assert.equal(
    presentInventoryDetailMutationNoticeCopy("locationsUnavailable", NOTICE_COPY).tone,
    "warning"
  );
});

test("inventory detail screen localizes mutation StatusNotice outcomes with captureMiseError", () => {
  assert.match(detailScreen, /MUTATION_NOTICE_KEYS/);
  assert.match(detailScreen, /presentInventoryDetailMutationNoticeCopy/);
  assert.match(detailScreen, /resolveInventoryDetailWasteFailureReason/);
  assert.match(detailScreen, /resolveInventoryDetailTransferFailureReason/);
  assert.match(detailScreen, /resolveInventoryDetailSaveFailureReason/);
  assert.match(detailScreen, /captureMiseError/);
  assert.match(detailScreen, /flow:\s*"inventory_detail"/);
  assert.match(detailScreen, /StatusNotice tone=\{notice\.tone\}/);
  assert.doesNotMatch(detailScreen, /messageIsError/);
  assert.doesNotMatch(
    detailScreen,
    /setMessage\(\s*(error\s+instanceof\s+Error\s*\?\s*error\.message|t\()/
  );
  assert.doesNotMatch(
    detailScreen,
    /\/insufficient quantity at the selected storage location\/i\.test/
  );
});

test("inventory detail mutation notice keys exist in EN, ES, and zh-Hans catalogs", () => {
  const keys = [
    "inventory.detail.notice.noWorkspaceTitle",
    "inventory.detail.notice.viewOnlyInventoryTitle",
    "inventory.detail.notice.viewOnlyOrderingTitle",
    "inventory.detail.notice.reviewFieldsTitle",
    "inventory.detail.notice.updatedTitle",
    "inventory.detail.notice.saveFailedTitle",
    "inventory.detail.notice.addedTitle",
    "inventory.detail.notice.addFailedTitle",
    "inventory.detail.notice.reviewWasteTitle",
    "inventory.detail.notice.wasteRecordedTitle",
    "inventory.detail.notice.wasteNothingOnHandTitle",
    "inventory.detail.notice.wasteNothingOnHandBody",
    "inventory.detail.notice.wasteLocationMissingTitle",
    "inventory.detail.notice.wasteLocationMissingBody",
    "inventory.detail.notice.wasteLocationInsufficientTitle",
    "inventory.detail.notice.wasteFailedTitle",
    "inventory.detail.notice.reviewTransferTitle",
    "inventory.detail.notice.transferRecordedTitle",
    "inventory.detail.notice.transferInsufficientTitle",
    "inventory.detail.notice.transferInsufficientBody",
    "inventory.detail.notice.transferSameLocationTitle",
    "inventory.detail.notice.transferSameLocationBody",
    "inventory.detail.notice.transferLocationMissingTitle",
    "inventory.detail.notice.transferLocationMissingBody",
    "inventory.detail.notice.transferFailedTitle",
    "inventory.detail.notice.locationAddedTitle",
    "inventory.detail.notice.locationFailedTitle",
    "inventory.detail.notice.locationsUnavailableTitle",
    "inventory.detail.notice.locationsUnavailableBody",
    "inventory.detail.notice.loadFailedTitle"
  ];
  for (const key of keys) {
    const matches = catalog.match(new RegExp(`"${key.replace(/\./g, "\\.")}"`, "g")) ?? [];
    assert.equal(matches.length, 3, `${key} should appear in EN/ES/zh-Hans`);
  }
});

test("inventory detail secondary load state separates failure from empty success", () => {
  assert.equal(
    resolveInventoryDetailSecondaryLoadState({ loadError: true, count: 0 }),
    "unavailable"
  );
  assert.equal(
    resolveInventoryDetailSecondaryLoadState({ loadError: false, count: 0 }),
    "empty"
  );
  assert.equal(
    resolveInventoryDetailSecondaryLoadState({ loadError: false, count: 3 }),
    "ready"
  );
  assert.equal(isInventoryDetailStationActionBlocked("unavailable"), true);
  assert.equal(isInventoryDetailStationActionBlocked("empty"), false);
  assert.equal(isInventoryDetailStationActionBlocked("ready"), false);
});

test("inventory detail secondary unavailable copy is localized warning content", () => {
  const copy = presentInventoryDetailSecondaryLoadCopy("unavailable", {
    unavailableTitle: "History unavailable",
    unavailableBody: "Reload inventory history."
  });
  assert.deepEqual(copy, {
    title: "History unavailable",
    message: "Reload inventory history."
  });
  assert.equal(
    presentInventoryDetailSecondaryLoadCopy("ready", {
      unavailableTitle: "History unavailable",
      unavailableBody: "Reload inventory history."
    }),
    null
  );
});

test("inventory detail fails closed when secondary movement location or balance loads fail", () => {
  assert.doesNotMatch(
    detailScreen,
    /fetchInventoryMovements\([^)]*\)\.catch\(\s*\(\)\s*=>\s*\[\]\s*as\s*InventoryMovement\[\]\s*\)/
  );
  assert.doesNotMatch(
    detailScreen,
    /fetchStorageLocations\([^)]*\)\.catch\(\s*\(\)\s*=>\s*\[\]\s*as\s*StorageLocation\[\]\s*\)/
  );
  assert.doesNotMatch(
    detailScreen,
    /fetchInventoryLocationBalances\([^)]*\)\.catch\(\s*\(\)\s*=>\s*\[\]\s*as\s*InventoryLocationBalance\[\]\s*\)/
  );
  assert.match(detailScreen, /resolveInventoryDetailSecondaryLoadState/);
  assert.match(detailScreen, /presentInventoryDetailSecondaryLoadCopy/);
  assert.match(detailScreen, /isInventoryDetailStationActionBlocked/);
  assert.match(detailScreen, /movementsLoadError/);
  assert.match(detailScreen, /storageLocationsLoadError/);
  assert.match(detailScreen, /locationBalancesLoadError/);
  assert.match(detailScreen, /operation:\s*"load_movements"/);
  assert.match(detailScreen, /operation:\s*"load_storage_locations"/);
  assert.match(detailScreen, /operation:\s*"load_location_balances"/);
  assert.match(detailScreen, /locationsUnavailable/);
  assert.match(detailScreen, /inventory\.detail\.movements\.unavailable\.title/);
  assert.match(detailScreen, /inventory\.detail\.locations\.unavailable\.title/);
  assert.match(detailScreen, /inventory\.detail\.balances\.unavailable\.title/);
  assert.match(catalog, /inventory\.detail\.movements\.unavailable\.title/);
  assert.match(catalog, /inventory\.detail\.locations\.unavailable\.title/);
  assert.match(catalog, /inventory\.detail\.balances\.unavailable\.title/);
  assert.match(
    catalog,
    /"inventory\.detail\.locations\.unavailable\.title":\s*"Estaciones no disponibles"/
  );
  assert.match(
    catalog,
    /"inventory\.detail\.movements\.unavailable\.title":\s*"库存历史不可用"/
  );
});
