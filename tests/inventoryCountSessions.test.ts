import assert from "node:assert/strict";
import { test } from "node:test";

import {
  applyCountApprovalsToInventory,
  assertSessionMutable,
  buildCountSessionLinesFromInventory,
  canApproveInventoryCountSession,
  canCancelInventoryCountSession,
  canDraftInventoryCountSession,
  mergeCountLineUpdates,
  mergeInventoryCountDraftMaps,
  planCountSessionApprovals,
  seedInventoryCountDraftMaps,
  summarizeCountSessionProgress
} from "../services/domain/inventoryCountSessions";
import type { InventoryCountLine, InventoryItem } from "../types/mise";

const item = (
  id: string,
  quantity: number,
  options?: Partial<Pick<InventoryItem, "canonical_unit" | "canonical_quantity_per_unit" | "canonical_unit_verification_status">>
): InventoryItem => ({
  id,
  restaurant_id: "rest_a",
  item_name: id,
  category: "Produce",
  unit: "lbs",
  current_quantity: quantity,
  par_level: 10,
  reorder_threshold: 4,
  estimated_unit_cost: 1,
  supplier_id: "10000000-0000-4000-8000-000000000009",
  supplier_name: "Local",
  last_updated: "2026-07-31T00:00:00.000Z",
  canonical_unit: options?.canonical_unit ?? "g",
  canonical_quantity_per_unit: options?.canonical_quantity_per_unit ?? 453.592,
  canonical_unit_verification_status: options?.canonical_unit_verification_status ?? "verified"
});

const line = (
  itemId: string,
  systemQuantity: number,
  countedQuantity: number | null
): InventoryCountLine => ({
  id: `line_${itemId}`,
  restaurant_id: "rest_a",
  session_id: "session_1",
  inventory_item_id: itemId,
  item_name: itemId,
  unit: "lbs",
  system_quantity_at_start: systemQuantity,
  counted_quantity: countedQuantity,
  note: null,
  created_at: "2026-07-31T00:00:00.000Z",
  updated_at: "2026-07-31T00:00:00.000Z"
});

test("summarizeCountSessionProgress tracks completeness and variance", () => {
  const summary = summarizeCountSessionProgress([
    line("tomatoes", 10, 8),
    line("lettuce", 5, null),
    line("eggs", 12, 12)
  ]);
  assert.equal(summary.totalLines, 3);
  assert.equal(summary.countedLines, 2);
  assert.equal(summary.remainingLines, 1);
  assert.equal(summary.varianceLines, 1);
  assert.equal(summary.canSubmit, false);
});

test("planCountSessionApprovals uses live on-hand as quantity_before and counted as after", () => {
  const planned = planCountSessionApprovals({
    inventoryItems: [item("tomatoes", 9), item("lettuce", 4)],
    lines: [line("tomatoes", 10, 8), line("lettuce", 5, 6)]
  });
  assert.equal(planned.length, 2);
  assert.equal(planned[0]?.quantityBefore, 9);
  assert.equal(planned[0]?.quantityAfter, 8);
  assert.equal(planned[0]?.variance, -1);
  assert.equal(planned[0]?.systemQuantityAtStart, 10);
  assert.equal(planned[1]?.changed, true);
});

test("applyCountApprovalsToInventory updates only counted items", () => {
  const approvals = planCountSessionApprovals({
    inventoryItems: [item("tomatoes", 9), item("lettuce", 4)],
    lines: [line("tomatoes", 10, 8), line("lettuce", 5, 4)]
  });
  const next = applyCountApprovalsToInventory(
    [item("tomatoes", 9), item("lettuce", 4)],
    approvals,
    "2026-07-31T01:00:00.000Z"
  );
  assert.equal(next[0]?.current_quantity, 8);
  assert.equal(next[1]?.current_quantity, 4);
  assert.equal(next[0]?.last_updated, "2026-07-31T01:00:00.000Z");
});

test("mergeCountLineUpdates rejects unknown items and accepts valid counts", () => {
  const lines = buildCountSessionLinesFromInventory(
    "rest_a",
    "session_1",
    [item("tomatoes", 10), item("lettuce", 5)],
    "2026-07-31T00:00:00.000Z"
  );
  const merged = mergeCountLineUpdates(lines, [
    { inventoryItemId: "tomatoes", countedQuantity: 7 }
  ]);
  assert.equal(merged.find((entry) => entry.inventory_item_id === "tomatoes")?.counted_quantity, 7);
  assert.equal(merged.find((entry) => entry.inventory_item_id === "lettuce")?.counted_quantity, null);
  assert.throws(
    () => mergeCountLineUpdates(lines, [{ inventoryItemId: "missing", countedQuantity: 1 }]),
    /not part of this session/i
  );
});

test("mergeCountLineUpdates persists optional variance notes and clears them", () => {
  const lines = buildCountSessionLinesFromInventory(
    "rest_a",
    "session_1",
    [item("tomatoes", 10), item("lettuce", 5)],
    "2026-07-31T00:00:00.000Z"
  );
  const withNote = mergeCountLineUpdates(lines, [
    { inventoryItemId: "tomatoes", countedQuantity: 8, note: "  Spill during prep  " }
  ]);
  assert.equal(withNote.find((entry) => entry.inventory_item_id === "tomatoes")?.note, "Spill during prep");
  assert.equal(withNote.find((entry) => entry.inventory_item_id === "lettuce")?.note, null);

  const cleared = mergeCountLineUpdates(withNote, [
    { inventoryItemId: "tomatoes", countedQuantity: 8, note: null }
  ]);
  assert.equal(cleared.find((entry) => entry.inventory_item_id === "tomatoes")?.note, null);

  assert.throws(
    () =>
      mergeCountLineUpdates(lines, [
        { inventoryItemId: "tomatoes", countedQuantity: 8, note: "n".repeat(241) }
      ]),
    /240/i
  );
});

test("planCountSessionApprovals carries count-line notes for ledger metadata", () => {
  const tomatoLine = line("tomatoes", 10, 8);
  tomatoLine.note = "Case short on delivery";
  const planned = planCountSessionApprovals({
    inventoryItems: [item("tomatoes", 9)],
    lines: [tomatoLine]
  });
  assert.equal(planned[0]?.note, "Case short on delivery");
  assert.equal(planned[0]?.changed, true);
});

test("assertSessionMutable enforces workflow transitions", () => {
  assert.doesNotThrow(() => assertSessionMutable({ status: "in_progress" }, "save"));
  assert.throws(() => assertSessionMutable({ status: "submitted" }, "save"), /in-progress/i);
  assert.doesNotThrow(() => assertSessionMutable({ status: "submitted" }, "approve"));
  assert.throws(() => assertSessionMutable({ status: "in_progress" }, "approve"), /Submit/i);
  assert.throws(() => assertSessionMutable({ status: "approved" }, "cancel"), /already closed/i);
});

test("staff may draft and submit counts; only managers approve or cancel", () => {
  assert.equal(canDraftInventoryCountSession("staff"), true);
  assert.equal(canDraftInventoryCountSession("manager"), true);
  assert.equal(canApproveInventoryCountSession("staff"), false);
  assert.equal(canApproveInventoryCountSession("manager"), true);
  assert.equal(canApproveInventoryCountSession("owner"), true);
  assert.equal(canCancelInventoryCountSession("staff"), false);
  assert.equal(canCancelInventoryCountSession("admin"), true);
  assert.equal(canDraftInventoryCountSession(null), false);
});

test("count sessions only include inventory items with verified canonical conversion", () => {
  const lines = buildCountSessionLinesFromInventory(
    "rest_a",
    "session_1",
    [
      item("tomatoes", 10),
      item("unverified", 4, { canonical_unit_verification_status: "draft" })
    ],
    "2026-07-31T00:00:00.000Z"
  );
  assert.equal(lines.length, 1);
  assert.equal(lines[0]?.inventory_item_id, "tomatoes");
  assert.throws(
    () =>
      buildCountSessionLinesFromInventory(
        "rest_a",
        "session_1",
        [item("unverified", 4, { canonical_unit_verification_status: "draft" })],
        "2026-07-31T00:00:00.000Z"
      ),
    /canonical units/i
  );
});

test("count draft maps seed from session lines and soft-refresh merge preserves operator input", () => {
  const seeded = seedInventoryCountDraftMaps([
    line("tomatoes", 10, 8),
    line("onions", 5, null)
  ]);
  assert.deepEqual(seeded.counts, { tomatoes: "8", onions: "" });
  assert.deepEqual(seeded.notes, { tomatoes: "", onions: "" });

  const merged = mergeInventoryCountDraftMaps(
    {
      counts: { tomatoes: "12.5", onions: "3", stale: "9" },
      notes: { tomatoes: "floor count", onions: "", stale: "gone" }
    },
    [
      line("tomatoes", 10, 8),
      line("onions", 5, 4),
      { ...line("peppers", 2, 1), note: "cooler" }
    ]
  );

  assert.deepEqual(merged.counts, {
    tomatoes: "12.5",
    onions: "3",
    peppers: "1"
  });
  assert.deepEqual(merged.notes, {
    tomatoes: "floor count",
    onions: "",
    peppers: "cooler"
  });
  assert.equal(Object.prototype.hasOwnProperty.call(merged.counts, "stale"), false);
});
