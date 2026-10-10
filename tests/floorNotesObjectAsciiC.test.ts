import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimFloorNotesObjectToken,
  canonicalizeFloorNotesObjectId,
  requireCanonicalFloorNotesTaskId
} from "../services/domain/floorNotesObjectIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/floorNotesObjectIdentity.ts", import.meta.url),
  "utf8"
);
const applicationSource = readFileSync(
  new URL("../services/application/floorNotes.ts", import.meta.url),
  "utf8"
);

const taskId = "floor_note_00000000-0000-4000-8000-000000000901";
const demoTaskId = "operator_task_demo-count";

test("MISE-005MJ pins floor-notes taskId to ASCII C", () => {
  assert.match(identitySource, /MISE-005MJ/);
  assert.match(applicationSource, /MISE-005MJ/);

  assert.match(
    identitySource,
    /export function asciiTrimFloorNotesObjectToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    applicationSource,
    /requireCanonicalFloorNotesTaskId\(input\.taskId\)/
  );
  assert.match(
    applicationSource,
    /from "\.\.\/domain\/floorNotesObjectIdentity"/
  );

  // Leave restaurant workspace on Unicode trim (owned by #730 / MISE-005LA).
  assert.match(
    applicationSource,
    /function requireRestaurantId\(restaurantId: string\) \{\s*const normalized = restaurantId\.trim\(\);\s*if \(!normalized\) throw new Error\("Missing restaurant workspace\."\);\s*return normalized;\s*\}/s
  );
  assert.match(
    applicationSource,
    /const restaurantId = requireRestaurantId\(input\.restaurantId\);\s*\/\/ MISE-005MJ: ASCII-C task identity for operator-task complete \/ floor-note done\.\s*const taskId = requireCanonicalFloorNotesTaskId\(input\.taskId\);/s
  );
  assert.match(
    applicationSource,
    /const restaurantId = requireRestaurantId\(input\.restaurantId\);\s*\/\/ MISE-005MJ: ASCII-C task identity for operator-task reopen\.\s*const taskId = requireCanonicalFloorNotesTaskId\(input\.taskId\);/s
  );
  assert.doesNotMatch(applicationSource, /requireCanonicalFloorNoteRestaurantId/);
  assert.doesNotMatch(applicationSource, /floorNoteRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /from "\.\/floorNoteRestaurantIdentity"/);
  assert.doesNotMatch(
    identitySource,
    /export function (?:asciiTrim|canonicalize|requireCanonical)FloorNoteRestaurant/
  );

  // Optional Unicode trim path must not remain on complete/reopen taskId.
  assert.doesNotMatch(applicationSource, /input\.taskId\.trim\(\)/);
  assert.doesNotMatch(applicationSource, /const taskId = input\.taskId\.trim\(\)/);

  // completeFloorNote still routes noteId through completeOperatorTask.
  assert.match(
    applicationSource,
    /export async function completeFloorNote\(\s*input: \{\s*restaurantId: string;\s*noteId: string;\s*now\?: string;\s*\}\): Promise<FloorNote \| null> \{\s*return completeOperatorTask\(\{\s*restaurantId: input\.restaurantId,\s*taskId: input\.noteId,\s*now: input\.now\s*\}\);\s*\}/s
  );

  // Leave sibling tips alone (do not import or define their helpers here).
  assert.doesNotMatch(identitySource, /restaurantTasksObjectIdentity/);
  assert.doesNotMatch(identitySource, /miseActionsObjectIdentity/);
  assert.doesNotMatch(identitySource, /deliveriesClientDeliveryIdentity/);
  assert.doesNotMatch(identitySource, /deliveriesSupplierOrderIdentity/);
  assert.doesNotMatch(identitySource, /ordersWorkflowObjectIdentity/);
  assert.doesNotMatch(identitySource, /posMappingWorkflowIdentity/);
  assert.doesNotMatch(identitySource, /purchaseLinesObjectIdentity/);
  assert.doesNotMatch(identitySource, /inventoryMenuItemIdentity/);
  assert.doesNotMatch(identitySource, /floorNoteRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /restaurantMemoryRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /activityEventRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /purchaseLineRestaurantIdentity/);
});

test("ASCII trim keeps ordinary floor-notes taskId padding stable", () => {
  assert.equal(asciiTrimFloorNotesObjectToken(`  ${taskId}  `), taskId);
  assert.equal(canonicalizeFloorNotesObjectId(`\t${taskId}\n`), taskId);
  assert.equal(requireCanonicalFloorNotesTaskId(` ${taskId} `), taskId);

  assert.equal(asciiTrimFloorNotesObjectToken(`  ${demoTaskId}  `), demoTaskId);
  assert.equal(canonicalizeFloorNotesObjectId(`\t${demoTaskId}\n`), demoTaskId);
  assert.equal(requireCanonicalFloorNotesTaskId(` ${demoTaskId} `), demoTaskId);
});

test("ASCII floor-notes taskId trim ignores NBSP; Unicode trim would invent identity", () => {
  const nbspPaddedTask = `\u00a0${taskId}\u00a0`;
  // Unicode trim invents an exact match against the unpadded task id.
  assert.equal(nbspPaddedTask.trim(), taskId);
  assert.notEqual(asciiTrimFloorNotesObjectToken(nbspPaddedTask), taskId);
  assert.equal(canonicalizeFloorNotesObjectId(nbspPaddedTask), null);
  assert.throws(
    () => requireCanonicalFloorNotesTaskId(nbspPaddedTask),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing operator task id."
  );

  const emSpacePaddedDemo = `\u2003${demoTaskId}\u2003`;
  assert.equal(emSpacePaddedDemo.trim(), demoTaskId);
  assert.equal(canonicalizeFloorNotesObjectId(emSpacePaddedDemo), null);
  assert.throws(
    () => requireCanonicalFloorNotesTaskId(emSpacePaddedDemo),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing operator task id."
  );
});

test("Floor-notes taskId rejects empty and control-bearing tokens", () => {
  assert.equal(canonicalizeFloorNotesObjectId(""), null);
  assert.equal(canonicalizeFloorNotesObjectId("   "), null);
  assert.equal(canonicalizeFloorNotesObjectId("a".repeat(129)), null);
  assert.equal(canonicalizeFloorNotesObjectId("bad\u0000id"), null);
  assert.throws(
    () => requireCanonicalFloorNotesTaskId(null),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing operator task id."
  );
  assert.throws(
    () => requireCanonicalFloorNotesTaskId(""),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing operator task id."
  );
  assert.throws(
    () => requireCanonicalFloorNotesTaskId(undefined),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing operator task id."
  );
  assert.throws(
    () => requireCanonicalFloorNotesTaskId("bad\u0000id"),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing operator task id."
  );
});
