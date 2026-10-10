import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimInventoryCountItemToken,
  canonicalizeInventoryCountItemId,
  requireCanonicalInventoryCountItemId
} from "../services/domain/inventoryCountItemIdentity";
import { mergeCountLineUpdates } from "../services/domain/inventoryCountSessions";
import type { InventoryCountLine } from "../types/mise";

const identitySource = readFileSync(
  new URL("../services/domain/inventoryCountItemIdentity.ts", import.meta.url),
  "utf8"
);
const sessionsSource = readFileSync(
  new URL("../services/domain/inventoryCountSessions.ts", import.meta.url),
  "utf8"
);

const inventoryItemId = "00000000-0000-4000-8000-000000000801";
const demoInventoryItemId = "tomatoes";

const line = (itemId: string): InventoryCountLine => ({
  id: `line_${itemId}`,
  restaurant_id: "rest_a",
  session_id: "session_1",
  inventory_item_id: itemId,
  item_name: itemId,
  unit: "lbs",
  system_quantity_at_start: 10,
  counted_quantity: null,
  note: null,
  created_at: "2026-07-31T00:00:00.000Z",
  updated_at: "2026-07-31T00:00:00.000Z"
});

test("MISE-005MN pins inventory count-session inventoryItemId to ASCII C", () => {
  assert.match(identitySource, /MISE-005MN/);
  assert.match(sessionsSource, /MISE-005MN/);

  assert.match(
    identitySource,
    /export function asciiTrimInventoryCountItemToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    sessionsSource,
    /requireCanonicalInventoryCountItemId\(update\.inventoryItemId\)/
  );
  assert.match(
    sessionsSource,
    /from "\.\/inventoryCountItemIdentity"/
  );

  // Leave count-line note on Unicode trim (operator free-text).
  assert.match(
    sessionsSource,
    /const normalized = update\.note\.trim\(\);/
  );
  assert.match(
    sessionsSource,
    /typeof line\.note === "string" && line\.note\.trim\(\)/
  );

  // Do not rewrite application inventory.ts paths owned by sibling tips.
  assert.doesNotMatch(sessionsSource, /inventoryItemIdentity/);
  assert.doesNotMatch(sessionsSource, /requireCanonicalInventoryItemId/);
  assert.doesNotMatch(identitySource, /from "\.\/inventoryItemIdentity"/);
  assert.doesNotMatch(
    identitySource,
    /export function (?:asciiTrim|canonicalize|requireCanonical)InventoryItem(?!Count)/
  );

  // Leave sibling tips alone (do not import or define their helpers here).
  assert.doesNotMatch(identitySource, /inventoryItemIdentity/);
  assert.doesNotMatch(identitySource, /inventoryMenuItemIdentity/);
  assert.doesNotMatch(identitySource, /inventoryRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /floorNotesObjectIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksObjectIdentity/);
  assert.doesNotMatch(identitySource, /miseActionsObjectIdentity/);
  assert.doesNotMatch(identitySource, /deliveriesSupplierOrderIdentity/);
  assert.doesNotMatch(identitySource, /deliveriesClientDeliveryIdentity/);
  assert.doesNotMatch(identitySource, /ordersWorkflowObjectIdentity/);
  assert.doesNotMatch(identitySource, /posMappingWorkflowIdentity/);
  assert.doesNotMatch(identitySource, /purchaseLinesObjectIdentity/);
  assert.doesNotMatch(identitySource, /setupReferenceIdentity/);
});

test("ASCII trim keeps ordinary count-session inventoryItemId padding stable", () => {
  assert.equal(asciiTrimInventoryCountItemToken(`  ${inventoryItemId}  `), inventoryItemId);
  assert.equal(canonicalizeInventoryCountItemId(`\t${inventoryItemId}\n`), inventoryItemId);
  assert.equal(requireCanonicalInventoryCountItemId(` ${inventoryItemId} `), inventoryItemId);

  assert.equal(asciiTrimInventoryCountItemToken(`  ${demoInventoryItemId}  `), demoInventoryItemId);
  assert.equal(canonicalizeInventoryCountItemId(`\t${demoInventoryItemId}\n`), demoInventoryItemId);
  assert.equal(requireCanonicalInventoryCountItemId(` ${demoInventoryItemId} `), demoInventoryItemId);

  const lines = [line(demoInventoryItemId), line("lettuce")];
  const merged = mergeCountLineUpdates(lines, [
    { inventoryItemId: `  ${demoInventoryItemId}  `, countedQuantity: 7 }
  ]);
  assert.equal(
    merged.find((entry) => entry.inventory_item_id === demoInventoryItemId)?.counted_quantity,
    7
  );
});

test("ASCII count-session inventoryItemId trim ignores NBSP; Unicode trim would invent identity", () => {
  const nbspPaddedItem = `\u00a0${inventoryItemId}\u00a0`;
  // Unicode trim invents an exact match against the unpadded inventory item id.
  assert.equal(nbspPaddedItem.trim(), inventoryItemId);
  assert.notEqual(asciiTrimInventoryCountItemToken(nbspPaddedItem), inventoryItemId);
  assert.equal(canonicalizeInventoryCountItemId(nbspPaddedItem), null);
  assert.throws(
    () => requireCanonicalInventoryCountItemId(nbspPaddedItem),
    (error: unknown) =>
      error instanceof Error && error.message === "Count line is missing an inventory item."
  );

  const emSpacePaddedDemo = `\u2003${demoInventoryItemId}\u2003`;
  assert.equal(emSpacePaddedDemo.trim(), demoInventoryItemId);
  assert.equal(canonicalizeInventoryCountItemId(emSpacePaddedDemo), null);
  assert.throws(
    () => requireCanonicalInventoryCountItemId(emSpacePaddedDemo),
    (error: unknown) =>
      error instanceof Error && error.message === "Count line is missing an inventory item."
  );

  const lines = [line(demoInventoryItemId)];
  // Unicode trim would invent a match against the unpadded session line id.
  assert.throws(
    () =>
      mergeCountLineUpdates(lines, [
        { inventoryItemId: emSpacePaddedDemo, countedQuantity: 8 }
      ]),
    (error: unknown) =>
      error instanceof Error && error.message === "Count line is missing an inventory item."
  );
});

test("Count-session inventoryItemId rejects empty and control-bearing tokens", () => {
  assert.equal(canonicalizeInventoryCountItemId(""), null);
  assert.equal(canonicalizeInventoryCountItemId("   "), null);
  assert.equal(canonicalizeInventoryCountItemId("a".repeat(129)), null);
  assert.equal(canonicalizeInventoryCountItemId("bad\u0000id"), null);
  assert.throws(
    () => requireCanonicalInventoryCountItemId(null),
    (error: unknown) =>
      error instanceof Error && error.message === "Count line is missing an inventory item."
  );
  assert.throws(
    () => requireCanonicalInventoryCountItemId(""),
    (error: unknown) =>
      error instanceof Error && error.message === "Count line is missing an inventory item."
  );
  assert.throws(
    () => requireCanonicalInventoryCountItemId(undefined),
    (error: unknown) =>
      error instanceof Error && error.message === "Count line is missing an inventory item."
  );
  assert.throws(
    () => requireCanonicalInventoryCountItemId("bad\u0000id"),
    (error: unknown) =>
      error instanceof Error && error.message === "Count line is missing an inventory item."
  );

  const lines = [line(demoInventoryItemId)];
  assert.throws(
    () => mergeCountLineUpdates(lines, [{ inventoryItemId: "", countedQuantity: 1 }]),
    (error: unknown) =>
      error instanceof Error && error.message === "Count line is missing an inventory item."
  );
});
